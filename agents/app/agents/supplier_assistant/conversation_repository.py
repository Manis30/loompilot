from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any, Dict, List, Optional, Tuple
import uuid

from app.core.logging import get_logger
from app.schemas.supplier_assistant_schema import (
    SupplierApprovalView,
    SupplierNegotiationStatus,
    SupplierOfferView,
)

logger = get_logger(__name__)


class SupplierConversationState:
    """Thread-safe state container for a supplier negotiation session."""

    def __init__(self, conversation_id: str, supplier_id: int, material_id: int):
        self.conversation_id = conversation_id
        self.supplier_id = supplier_id
        self.material_id = material_id
        self.status = SupplierNegotiationStatus.INITIAL
        self.messages: List[Dict[str, Any]] = []
        self.active_offer: Optional[SupplierOfferView] = None
        self.last_supplier_price: Optional[float] = None
        self.last_counter_price: Optional[float] = None
        self.negotiated_payment_terms: Optional[str] = None
        self.created_at = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)


class SupplierConversationRepository:
    """
    In-memory, thread-safe conversation and approval repository
    for LoomPilot Material Supplier Assistant negotiations.
    """

    def __init__(self):
        self._conversations: Dict[str, SupplierConversationState] = {}
        self._approvals: Dict[str, SupplierApprovalView] = {}
        self._lock = Lock()

    def get_or_create(
        self,
        conversation_id: str,
        supplier_id: int,
        material_id: int,
    ) -> SupplierConversationState:
        with self._lock:
            if conversation_id not in self._conversations:
                self._conversations[conversation_id] = SupplierConversationState(
                    conversation_id=conversation_id,
                    supplier_id=supplier_id,
                    material_id=material_id,
                )
            state = self._conversations[conversation_id]
            state.supplier_id = supplier_id
            state.material_id = material_id
            return state

    def get(self, conversation_id: str) -> Optional[SupplierConversationState]:
        with self._lock:
            return self._conversations.get(conversation_id)

    def record_message(
        self,
        conversation_id: str,
        sender: str,
        text: str,
        intent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        with self._lock:
            state = self._conversations.get(conversation_id)
            if state:
                state.messages.append({
                    "messageId": f"MSG-{uuid.uuid4().hex[:8].upper()}",
                    "sender": sender,
                    "message": text,
                    "intent": intent,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "metadata": metadata or {},
                })
                state.updated_at = datetime.now(timezone.utc)

    def set_active_offer(
        self,
        conversation_id: str,
        material_id: int,
        material_name: str,
        quantity: float,
        unit: str,
        supplier_price: float,
        counter_price: Optional[float],
        payment_terms: Optional[str] = None,
        status: SupplierNegotiationStatus = SupplierNegotiationStatus.COUNTER_MADE,
        validity_days: int = 7,
    ) -> SupplierOfferView:
        with self._lock:
            state = self._conversations.get(conversation_id)
            now = datetime.now(timezone.utc)
            expires = now + timedelta(days=validity_days)

            offer = SupplierOfferView(
                offerId=f"SUP-OFFER-{uuid.uuid4().hex[:8].upper()}",
                conversationId=conversation_id,
                materialId=material_id,
                materialName=material_name,
                quantity=quantity,
                unit=unit,
                supplierQuotedPriceINR=supplier_price,
                loompilotCounterPriceINR=counter_price,
                paymentTerms=payment_terms,
                status=status.value,
                createdAt=now.isoformat(),
                offerExpiresAt=expires.isoformat(),
            )

            if state:
                state.active_offer = offer
                state.status = status
                state.last_supplier_price = supplier_price
                state.last_counter_price = counter_price
                state.negotiated_payment_terms = payment_terms
                state.updated_at = now

            return offer

    def check_offer_validity(self, offer: SupplierOfferView) -> Tuple[bool, str]:
        """Validate if commercial offer is active and not expired."""
        try:
            exp = datetime.fromisoformat(offer.offerExpiresAt)
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            if now > exp:
                return False, "Offer has expired."
            return True, "Offer is valid."
        except Exception as e:
            logger.warning(f"Error checking supplier offer validity: {e}")
            return True, "Valid"

    def create_approval_request(
        self,
        conversation_id: str,
        supplier_id: int,
        supplier_name: str,
        material_id: int,
        material_name: str,
        quantity: float,
        unit: str,
        supplier_quoted_price: float,
        max_authorized_price: float,
        target_price: float,
        reason: str,
    ) -> SupplierApprovalView:
        with self._lock:
            approval_id = f"SUP-APR-{uuid.uuid4().hex[:8].upper()}"
            view = SupplierApprovalView(
                approvalId=approval_id,
                conversationId=conversation_id,
                supplierId=supplier_id,
                supplierName=supplier_name,
                materialId=material_id,
                materialName=material_name,
                quantity=quantity,
                unit=unit,
                supplierQuotedPrice=supplier_quoted_price,
                maxAuthorizedPrice=max_authorized_price,
                targetPrice=target_price,
                reason=reason,
                status="PENDING",
                createdAt=datetime.now(timezone.utc).isoformat(),
            )
            self._approvals[approval_id] = view

            state = self._conversations.get(conversation_id)
            if state:
                state.status = SupplierNegotiationStatus.PENDING_APPROVAL
                state.updated_at = datetime.now(timezone.utc)

            return view

    def decide_approval(
        self,
        approval_id: str,
        decision: str,
        decided_by: str = "procurement_manager",
        authorized_price: Optional[float] = None,
        notes: Optional[str] = None,
    ) -> Optional[SupplierApprovalView]:
        with self._lock:
            appr = self._approvals.get(approval_id)
            if not appr:
                return None

            now = datetime.now(timezone.utc).isoformat()
            decision_norm = decision.strip().upper()

            appr.status = decision_norm
            appr.decision = decision_norm
            appr.decidedAt = now
            appr.decidedBy = decided_by

            state = self._conversations.get(appr.conversationId)
            if state:
                if decision_norm == "APPROVE":
                    state.status = SupplierNegotiationStatus.APPROVED
                    if authorized_price is not None:
                        state.last_counter_price = authorized_price
                else:
                    state.status = SupplierNegotiationStatus.REJECTED
                state.updated_at = datetime.now(timezone.utc)

            return appr

    def get_pending_approvals(self) -> List[SupplierApprovalView]:
        with self._lock:
            return [a for a in self._approvals.values() if a.status == "PENDING"]

    def get_approval(self, approval_id: str) -> Optional[SupplierApprovalView]:
        with self._lock:
            return self._approvals.get(approval_id)


_global_supplier_conv_repo: Optional[SupplierConversationRepository] = None


def get_supplier_conversation_repository() -> SupplierConversationRepository:
    global _global_supplier_conv_repo
    if _global_supplier_conv_repo is None:
        _global_supplier_conv_repo = SupplierConversationRepository()
    return _global_supplier_conv_repo
