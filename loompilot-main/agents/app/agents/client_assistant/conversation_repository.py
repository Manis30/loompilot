from datetime import datetime, timedelta
from threading import RLock
from typing import Any, Dict, List, Optional, Tuple
import uuid

from app.core.logging import get_logger
from app.schemas.client_assistant_schema import (
    ChatMessage,
    ConversationDetailResponse,
    NegotiatedOffer,
    NegotiationStatus,
    OfferStatus,
    PendingApprovalRecord,
    SenderRole,
)

logger = get_logger(__name__)


class ConversationNotFoundError(KeyError):
    """Raised when a requested conversation ID does not exist."""
    pass


class ApprovalNotFoundError(KeyError):
    """Raised when a requested approval ID is not found."""
    pass


class ConversationState:
    """In-memory encapsulation of an isolated customer negotiation thread."""

    def __init__(
        self,
        conversation_id: str,
        tenant_id: str,
        customer_id: int,
        quotation_id: str,
        original_price_per_unit: float,
        minimum_authorized_price: float,
        current_offer_per_unit: Optional[float] = None,
    ):
        self.conversation_id = conversation_id
        self.tenant_id = tenant_id
        self.customer_id = customer_id
        self.quotation_id = quotation_id
        self.negotiation_status = NegotiationStatus.INITIAL
        self.original_price_per_unit = round(original_price_per_unit, 2)
        self.current_offer_per_unit = round(current_offer_per_unit or original_price_per_unit, 2)
        self.customer_target_price: Optional[float] = None
        self.minimum_authorized_price = round(minimum_authorized_price, 2)
        self.requires_approval: bool = False
        self.pending_approval_id: Optional[str] = None
        self.messages: List[ChatMessage] = []
        self.offers: List[NegotiatedOffer] = []
        self.active_offer: Optional[NegotiatedOffer] = None
        self.metadata: Dict[str, Any] = {}
        self.created_timestamp = datetime.now().isoformat()
        self.updated_timestamp = datetime.now().isoformat()

    def create_offer(
        self,
        offer_id: str,
        quotation_id: str,
        original_price: float,
        revised_price: float,
        quantity: int,
        validity_days: int = 15,
    ) -> NegotiatedOffer:
        """
        Create and register a formal commercial offer with validity window.
        Validates timestamps against current server time: expiresAt must be strictly > createdAt.
        """
        if validity_days <= 0:
            validity_days = 15

        if self.active_offer and self.active_offer.offerStatus == OfferStatus.ACTIVE:
            self.active_offer.offerStatus = OfferStatus.SUPERSEDED

        created_at = datetime.now()
        expires_at = created_at + timedelta(days=validity_days)

        # Enforce server-time validity invariants
        if expires_at <= created_at:
            raise ValueError(f"Offer expiry {expires_at} must be strictly later than creation time {created_at}.")
        if expires_at <= datetime.now():
            raise ValueError("Cannot create an offer that is already expired.")

        orig_total = round(original_price * quantity, 2)
        rev_total = round(revised_price * quantity, 2)
        savings = round(orig_total - rev_total, 2)
        disc_pct = (
            round(((original_price - revised_price) / original_price) * 100.0, 2)
            if original_price > 0
            else 0.0
        )

        offer = NegotiatedOffer(
            offerId=offer_id,
            quotationId=quotation_id,
            originalPricePerUnit=round(original_price, 2),
            revisedPricePerUnit=round(revised_price, 2),
            orderQuantity=quantity,
            originalQuotationTotal=orig_total,
            revisedQuotationTotal=rev_total,
            totalSavings=savings,
            discountPercentage=disc_pct,
            createdAt=created_at.isoformat(),
            expiresAt=expires_at.isoformat(),
            offerStatus=OfferStatus.ACTIVE,
        )
        self.offers.append(offer)
        self.active_offer = offer
        self.current_offer_per_unit = round(revised_price, 2)
        self.updated_timestamp = created_at.isoformat()
        return offer

    def get_active_offer(self) -> Optional[NegotiatedOffer]:
        """Return active offer, evaluating expiration dynamically against current server time."""
        if not self.active_offer:
            return None
        if self.active_offer.offerStatus == OfferStatus.ACTIVE:
            try:
                exp_dt = datetime.fromisoformat(self.active_offer.expiresAt)
                if exp_dt <= datetime.now():
                    self.active_offer.offerStatus = OfferStatus.EXPIRED
            except Exception:
                pass
        return self.active_offer

    def get_matching_active_offer(self, unit_price: float) -> Optional[NegotiatedOffer]:
        """Check if an active, unexpired offer already matches the requested unit price."""
        offer = self.get_active_offer()
        if offer and offer.offerStatus == OfferStatus.ACTIVE:
            if abs(offer.revisedPricePerUnit - round(unit_price, 2)) < 0.01:
                return offer
        return None

    def accept_active_offer(
        self,
        quotation_id: Optional[str] = None,
    ) -> Tuple[Optional[NegotiatedOffer], str]:
        """
        Validate and accept active commercial offer.
        Verifies existence, quotation ownership, and server timestamp validity.
        Returns (offer, status_code).
        """
        offer = self.get_active_offer()
        if not offer:
            return None, "NO_ACTIVE_OFFER"

        # Check quotation isolation
        if quotation_id and offer.quotationId.strip().upper() != str(quotation_id).strip().upper():
            logger.warning(
                f"Quotation mismatch: offer '{offer.offerId}' belongs to quotation '{offer.quotationId}', "
                f"not '{quotation_id}'."
            )
            return None, "QUOTATION_MISMATCH"

        # Check expiration against actual server timestamp
        try:
            exp_dt = datetime.fromisoformat(offer.expiresAt)
            if exp_dt <= datetime.now() or offer.offerStatus == OfferStatus.EXPIRED:
                offer.offerStatus = OfferStatus.EXPIRED
                self.negotiation_status = NegotiationStatus.OFFER_EXPIRED
                self.updated_timestamp = datetime.now().isoformat()
                return None, "OFFER_EXPIRED"
        except Exception:
            pass

        if offer.offerStatus != OfferStatus.ACTIVE:
            return None, offer.offerStatus.value

        offer.offerStatus = OfferStatus.ACCEPTED
        self.negotiation_status = NegotiationStatus.CUSTOMER_ACCEPTED
        self.updated_timestamp = datetime.now().isoformat()
        return offer, "ACCEPTED"

    def decline_active_offer(self) -> Optional[NegotiatedOffer]:
        """Mark active offer as declined by customer."""
        offer = self.get_active_offer()
        if offer and offer.offerStatus == OfferStatus.ACTIVE:
            offer.offerStatus = OfferStatus.DECLINED
            self.negotiation_status = NegotiationStatus.CUSTOMER_DECLINED
            self.updated_timestamp = datetime.now().isoformat()
            return offer
        return offer

    def add_message(
        self,
        sender: str,
        message: str,
        intent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ChatMessage:
        """Append a new message to the conversation context."""
        msg_id = f"MSG-{len(self.messages) + 1:04d}"
        now_ts = datetime.now().isoformat()
        chat_msg = ChatMessage(
            messageId=msg_id,
            sender=sender,
            message=message,
            intent=intent,
            timestamp=now_ts,
            metadata=metadata or {},
        )
        self.messages.append(chat_msg)
        self.updated_timestamp = now_ts
        return chat_msg

    def to_detail_response(self) -> ConversationDetailResponse:
        """Convert state to API presentation response."""
        return ConversationDetailResponse(
            success=True,
            agent="client_assistant_agent",
            conversationId=self.conversation_id,
            tenantId=self.tenant_id,
            customerId=self.customer_id,
            quotationId=self.quotation_id,
            negotiationStatus=self.negotiation_status,
            originalPricePerUnit=self.original_price_per_unit,
            currentOfferPerUnit=self.current_offer_per_unit,
            customerTargetPrice=self.customer_target_price,
            minimumAuthorizedPrice=self.minimum_authorized_price,
            requiresApproval=self.requires_approval,
            pendingApprovalId=self.pending_approval_id,
            messageCount=len(self.messages),
            messages=self.messages,
            negotiationSummary={
                "createdTimestamp": self.created_timestamp,
                "updatedTimestamp": self.updated_timestamp,
                "concessionPercentage": round(
                    ((self.original_price_per_unit - self.current_offer_per_unit) / self.original_price_per_unit) * 100,
                    2,
                ) if self.original_price_per_unit > 0 else 0.0,
            },
        )


class ConversationRepository:
    """
    Thread-safe repository for negotiation conversations and human approval escalations.
    Guarantees strict tenant and customer boundaries.
    """

    def __init__(self):
        self._conversations: Dict[str, ConversationState] = {}
        self._approvals: Dict[str, PendingApprovalRecord] = {}
        self._lock = RLock()
        self._conv_seq: int = 0
        self._app_seq: int = 0
        self._offer_seq: int = 0

    def generate_conversation_id(self) -> str:
        with self._lock:
            self._conv_seq += 1
            return f"CONV-{self._conv_seq:03d}"

    def generate_approval_id(self) -> str:
        with self._lock:
            self._app_seq += 1
            return f"APP-{self._app_seq:03d}"

    def generate_offer_id(self) -> str:
        with self._lock:
            self._offer_seq += 1
            return f"OFFER-{self._offer_seq:03d}"

    def get_or_create(
        self,
        conversation_id: Optional[str],
        tenant_id: str,
        customer_id: int,
        quotation_id: str,
        original_price_per_unit: float,
        minimum_authorized_price: float,
    ) -> ConversationState:
        """
        Retrieve active conversation or create a new session.
        Enforces tenant isolation and customer ownership.
        """
        with self._lock:
            if conversation_id and conversation_id in self._conversations:
                conv = self._conversations[conversation_id]
                # Tenant isolation check
                if tenant_id and conv.tenant_id != tenant_id:
                    raise PermissionError(
                        f"Tenant mismatch: conversation '{conversation_id}' belongs to tenant '{conv.tenant_id}'."
                    )
                # Customer isolation check
                if conv.customer_id != customer_id:
                    raise PermissionError(
                        f"Customer mismatch: conversation '{conversation_id}' belongs to customer '{conv.customer_id}'."
                    )
                return conv

            # Initialize new conversation
            c_id = conversation_id or f"CONV-{self._conv_seq + 1:03d}"
            if not conversation_id:
                self._conv_seq += 1

            new_conv = ConversationState(
                conversation_id=c_id,
                tenant_id=tenant_id,
                customer_id=customer_id,
                quotation_id=quotation_id,
                original_price_per_unit=original_price_per_unit,
                minimum_authorized_price=minimum_authorized_price,
            )
            self._conversations[c_id] = new_conv
            logger.info(
                f"Initialized conversation '{c_id}' for tenant='{tenant_id}', "
                f"customer={customer_id}, quotation='{quotation_id}'"
            )
            return new_conv

    def get(self, conversation_id: str, tenant_id: Optional[str] = None) -> ConversationState:
        """Retrieve conversation by ID with tenant verification."""
        with self._lock:
            conv = self._conversations.get(conversation_id)
            if not conv:
                raise ConversationNotFoundError(f"Conversation '{conversation_id}' not found.")
            if tenant_id and conv.tenant_id != tenant_id:
                raise PermissionError(f"Access denied: conversation does not belong to tenant '{tenant_id}'.")
            return conv

    def list_conversations(
        self,
        tenant_id: Optional[str] = None,
        customer_id: Optional[int] = None,
    ) -> List[ConversationState]:
        """List conversations matching tenant and optional customer filters."""
        with self._lock:
            results = list(self._conversations.values())
            if tenant_id:
                results = [c for c in results if c.tenant_id == tenant_id]
            if customer_id is not None:
                results = [c for c in results if c.customer_id == customer_id]
            return results

    def create_pending_approval(
        self,
        conversation_id: str,
        tenant_id: str,
        customer_id: int,
        quotation_id: str,
        requested_price_per_unit: float,
        original_price_per_unit: float,
        minimum_authorized_price: float,
        reason: str,
    ) -> PendingApprovalRecord:
        """Create a formal managerial escalation record."""
        with self._lock:
            self._app_seq += 1
            app_id = f"APP-{self._app_seq:03d}"
            req_disc = (
                round(((original_price_per_unit - requested_price_per_unit) / original_price_per_unit) * 100, 2)
                if original_price_per_unit > 0
                else 0.0
            )
            record = PendingApprovalRecord(
                approvalId=app_id,
                conversationId=conversation_id,
                tenantId=tenant_id,
                customerId=customer_id,
                quotationId=quotation_id,
                requestedPricePerUnit=round(requested_price_per_unit, 2),
                originalPricePerUnit=round(original_price_per_unit, 2),
                minimumAuthorizedPrice=round(minimum_authorized_price, 2),
                requestedDiscountPct=req_disc,
                reason=reason,
                status="PENDING",
                createdTimestamp=datetime.now().isoformat(),
            )
            self._approvals[app_id] = record

            # Link into conversation
            if conversation_id in self._conversations:
                conv = self._conversations[conversation_id]
                conv.pending_approval_id = app_id
                conv.requires_approval = True
                conv.negotiation_status = NegotiationStatus.PENDING_APPROVAL

            logger.info(f"Created pending approval record '{app_id}' for conversation '{conversation_id}'.")
            return record

    def list_pending_approvals(self, tenant_id: Optional[str] = None) -> List[PendingApprovalRecord]:
        """List active pending approval records."""
        with self._lock:
            res = [a for a in self._approvals.values() if a.status == "PENDING"]
            if tenant_id:
                res = [a for a in res if a.tenantId == tenant_id]
            return res

    def get_approval(self, approval_id: str, tenant_id: Optional[str] = None) -> PendingApprovalRecord:
        """Retrieve approval record by ID."""
        with self._lock:
            app = self._approvals.get(approval_id)
            if not app:
                raise ApprovalNotFoundError(f"Approval record '{approval_id}' not found.")
            if tenant_id and app.tenantId != tenant_id:
                raise PermissionError(f"Access denied: approval record does not belong to tenant '{tenant_id}'.")
            return app

    def record_approval_decision(
        self,
        approval_id: str,
        authorized_by: str,
        decision: str,
        approved_price_per_unit: Optional[float] = None,
        notes: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> PendingApprovalRecord:
        """Apply executive approval or rejection decision."""
        with self._lock:
            app = self.get_approval(approval_id, tenant_id=tenant_id)
            decision_clean = str(decision).strip().upper()
            now_ts = datetime.now().isoformat()

            app.decidedBy = authorized_by
            app.decisionTimestamp = now_ts
            app.decisionNotes = notes or ""

            conv = self._conversations.get(app.conversationId)

            if decision_clean in ("APPROVE", "APPROVED"):
                app.status = "APPROVED"
                effective_price = approved_price_per_unit or app.requestedPricePerUnit
                if conv:
                    conv.current_offer_per_unit = round(effective_price, 2)
                    conv.negotiation_status = NegotiationStatus.APPROVED
                    conv.requires_approval = False
                    conv.add_message(
                        sender=SenderRole.HUMAN_APPROVER.value,
                        message=(
                            f"Commercial exception approved by {authorized_by}: Unit price authorized at "
                            f"₹{effective_price:.2f}. Notes: {notes or 'Approved by executive management.'}"
                        ),
                        intent="APPROVAL_GRANTED",
                        metadata={"approvedPricePerUnit": effective_price, "decidedBy": authorized_by},
                    )
            else:
                app.status = "REJECTED"
                if conv:
                    conv.negotiation_status = NegotiationStatus.REJECTED
                    conv.requires_approval = False
                    conv.add_message(
                        sender=SenderRole.HUMAN_APPROVER.value,
                        message=(
                            f"Commercial exception declined by {authorized_by}. Notes: {notes or 'Floor price cannot be breached.'}"
                        ),
                        intent="APPROVAL_REJECTED",
                        metadata={"decidedBy": authorized_by},
                    )

            logger.info(f"Recorded decision '{app.status}' for approval '{approval_id}' by '{authorized_by}'.")
            return app


_conversation_repo_instance: Optional[ConversationRepository] = None


def get_conversation_repository() -> ConversationRepository:
    """Return singleton conversation repository."""
    global _conversation_repo_instance
    if _conversation_repo_instance is None:
        _conversation_repo_instance = ConversationRepository()
    return _conversation_repo_instance
