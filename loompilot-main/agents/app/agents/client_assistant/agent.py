from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from app.core.logging import get_logger
from app.data.data_repository import DataRepository, get_data_repository
from app.schemas.client_assistant_schema import (
    AlternativeRecommendation,
    AlternativesResponse,
    ChatMessage,
    ClientAssistantChatRequest,
    ClientAssistantChatResponse,
    ClientAssistantCustomerResponse,
    ClientAssistantInternalResponse,
    ConversationDetailResponse,
    CustomerIntent,
    CustomerOfferView,
    HumanApprovalResponse,
    InternalNegotiationMetadata,
    NegotiatedOffer,
    NegotiationStatus,
    OfferStatus,
    PendingApprovalRecord,
    SenderRole,
)
from app.schemas.quotation_schema import QuotationDetail, QuotationStatus
from app.agents.quotation.quotation_repository import (
    QuotationRepository,
    get_quotation_repository,
)
from app.agents.client_assistant.customer_service import (
    CustomerNotFoundError,
    CustomerOwnershipError,
    CustomerService,
)
from app.agents.client_assistant.conversation_repository import (
    ApprovalNotFoundError,
    ConversationNotFoundError,
    ConversationRepository,
    ConversationState,
    get_conversation_repository,
)
from app.agents.client_assistant.bargaining_service import (
    BargainingDecision,
    BargainingService,
)
from app.agents.client_assistant.intent_classifier import IntentClassifier
from app.agents.client_assistant.objection_handler import ObjectionHandler
from app.agents.client_assistant.alternative_service import AlternativeService
from app.agents.client_assistant.sales_order_service import SalesOrderService
from app.agents.client_assistant.explanation_service import ClientAssistantExplanationService

logger = get_logger(__name__)


class ClientAssistantAgent:
    """
    Client Assistant AI Agent for LoomPilot manufacturing management platform.
    Functions as an intelligent B2B manufacturing sales representative capable of customer chat,
    quotation explanation, controlled price bargaining, objection handling, feasibility-grounded
    alternative recommendations, and managerial approval escalation.
    """

    def __init__(
        self,
        repository: Optional[DataRepository] = None,
        quotation_repo: Optional[QuotationRepository] = None,
        conversation_repo: Optional[ConversationRepository] = None,
        customer_service: Optional[CustomerService] = None,
        bargaining_service: Optional[BargainingService] = None,
        intent_classifier: Optional[IntentClassifier] = None,
        objection_handler: Optional[ObjectionHandler] = None,
        alternative_service: Optional[AlternativeService] = None,
        sales_order_service: Optional[SalesOrderService] = None,
        explanation_service: Optional[ClientAssistantExplanationService] = None,
    ):
        self.repository = repository or get_data_repository()
        self.quotation_repo = quotation_repo or get_quotation_repository()
        self.conversation_repo = conversation_repo or get_conversation_repository()
        self.customer_service = customer_service or CustomerService(self.repository, self.quotation_repo)
        self.bargaining_service = bargaining_service or BargainingService()
        self.intent_classifier = intent_classifier or IntentClassifier()
        self.objection_handler = objection_handler or ObjectionHandler()
        self.alternative_service = alternative_service or AlternativeService(self.repository)
        self.sales_order_service = sales_order_service or SalesOrderService(self.repository)
        self.explanation_service = explanation_service or ClientAssistantExplanationService()

    def process_chat_message(
        self,
        request: ClientAssistantChatRequest,
        include_internal: bool = True,
    ) -> Union[ClientAssistantCustomerResponse, ClientAssistantInternalResponse]:
        """
        Execute full customer conversation and bargaining pipeline.
        Identifies customer, validates quotation ownership, classifies message,
        evaluates pricing authorization bounds, escalates approvals if needed,
        and generates professional customer-facing messaging.
        """
        now_ts = datetime.now().isoformat()
        logger.info(
            f"Processing client assistant chat message: tenant='{request.tenantId}', "
            f"customer={request.customerId}, quotation='{request.quotationId}', "
            f"conversation='{request.conversationId}'"
        )

        # STEP 1: Identify customer
        customer_profile = self.customer_service.get_customer_profile(request.customerId)

        # STEP 2: Retrieve relevant quotation and enforce tenant & customer boundaries
        quotation = self.customer_service.get_quotation_for_customer(
            quotation_identifier=request.quotationId,
            customer_id=request.customerId,
            tenant_id=request.tenantId,
        )

        # STEP 3: Validate quotation eligibility and financial pricing completeness
        is_valid, validation_status = self.customer_service.validate_quotation(quotation)
        fin = quotation.financialSummary
        quantity = max(1, quotation.quantity)
        original_price = float(
            fin.sellingPricePerUnit
            or (fin.finalQuotationAmount / quantity if fin.finalQuotationAmount else None)
            or 250.0
        )
        min_authorized_price = self.bargaining_service.calculate_minimum_authorized_price(
            quotation=quotation,
            customer_profile=customer_profile,
        )

        if not is_valid:
            if validation_status == "EXPIRED_QUOTATION":
                exp_date = quotation.validUntil or "earlier"
                msg = (
                    f"Hello {customer_profile.customerName},\n\n"
                    f"We have reviewed quotation {quotation.quotationNumber or request.quotationId}. Please note that this quotation "
                    f"expired on {exp_date} and is no longer valid for active price negotiation.\n\n"
                    "Raw material spot rates and factory production schedules are updated periodically. "
                    "We would be delighted to prepare a refreshed quotation based on current market rates. "
                    "Please let us know if you would like us to generate an updated quotation for you."
                )
                customer_view = CustomerOfferView(
                    message=msg,
                    offerId=None,
                    originalPricePerUnit=round(original_price, 2),
                    revisedPricePerUnit=round(original_price, 2),
                    orderQuantity=quotation.quantity,
                    originalQuotationTotal=round(original_price * quotation.quantity, 2),
                    revisedQuotationTotal=round(original_price * quotation.quantity, 2),
                    totalSavings=0.0,
                    discountPercentage=0.0,
                    taxStatus="TAX_NOT_CALCULATED",
                    subtotalAmount=round(original_price * quotation.quantity, 2),
                    taxAmount=None,
                    finalQuotationTotalWithTax=None,
                    finalPayableAmount=None,
                    offerExpiresAt=None,
                    suggestedAlternatives=None,
                )
                if not include_internal:
                    return ClientAssistantCustomerResponse(
                        success=True,
                        agent="client_assistant_agent",
                        conversationId=request.conversationId or "CONV-EXPIRED",
                        customerId=request.customerId,
                        quotationId=request.quotationId,
                        intent=CustomerIntent.GENERAL_QUERY,
                        negotiationStatus=NegotiationStatus.CLOSED,
                        customerResponse=customer_view,
                        salesOrderId=None,
                        orderCreationStatus=None,
                        timestamp=now_ts,
                    )
                internal_meta = InternalNegotiationMetadata(
                    minimumAuthorizedPrice=min_authorized_price,
                    requiresApproval=False,
                    pendingApprovalId=None,
                    pricingValidationStatus="EXPIRED_QUOTATION",
                    customerTargetPrice=None,
                    concessionGrantedPct=0.0,
                    productionCostPerUnit=fin.productionCostPerUnit,
                    approvalNotes="Quotation has expired. Commercial negotiation blocked.",
                )
                return ClientAssistantInternalResponse(
                    success=True,
                    agent="client_assistant_agent",
                    conversationId=request.conversationId or "CONV-EXPIRED",
                    customerId=request.customerId,
                    quotationId=request.quotationId,
                    intent=CustomerIntent.GENERAL_QUERY,
                    negotiationStatus=NegotiationStatus.CLOSED,
                    customerResponse=customer_view,
                    salesOrderId=None,
                    orderCreationStatus=None,
                    internalMetadata=internal_meta,
                    timestamp=now_ts,
                    response=msg,
                    originalPricePerUnit=original_price,
                    currentOfferPerUnit=original_price,
                    customerTargetPrice=None,
                    minimumAuthorizedPrice=min_authorized_price,
                    requiresApproval=False,
                    pendingApprovalId=None,
                    suggestedAlternatives=None,
                )
            elif validation_status == "MISSING_PRICING_DATA":
                msg = (
                    f"Hello {customer_profile.customerName},\n\n"
                    f"Thank you for contacting us regarding quotation {quotation.quotationNumber or request.quotationId}. "
                    "Our commercial costing team is currently reviewing the complete bill of materials and machine routing "
                    "specifications for this order.\n\n"
                    "To ensure complete pricing accuracy, we will finalize the verified cost breakdown and get back to you with confirmed terms shortly."
                )
                customer_view = CustomerOfferView(
                    message=msg,
                    offerId=None,
                    originalPricePerUnit=round(original_price, 2),
                    revisedPricePerUnit=round(original_price, 2),
                    orderQuantity=quotation.quantity,
                    originalQuotationTotal=round(original_price * quotation.quantity, 2),
                    revisedQuotationTotal=round(original_price * quotation.quantity, 2),
                    totalSavings=0.0,
                    discountPercentage=0.0,
                    taxStatus="TAX_NOT_CALCULATED",
                    subtotalAmount=round(original_price * quotation.quantity, 2),
                    taxAmount=None,
                    finalQuotationTotalWithTax=None,
                    finalPayableAmount=None,
                    offerExpiresAt=None,
                    suggestedAlternatives=None,
                )
                if not include_internal:
                    return ClientAssistantCustomerResponse(
                        success=True,
                        agent="client_assistant_agent",
                        conversationId=request.conversationId or "CONV-INCOMPLETE",
                        customerId=request.customerId,
                        quotationId=request.quotationId,
                        intent=CustomerIntent.GENERAL_QUERY,
                        negotiationStatus=NegotiationStatus.PENDING_APPROVAL,
                        customerResponse=customer_view,
                        salesOrderId=None,
                        orderCreationStatus=None,
                        timestamp=now_ts,
                    )
                internal_meta = InternalNegotiationMetadata(
                    minimumAuthorizedPrice=min_authorized_price,
                    requiresApproval=True,
                    pendingApprovalId=None,
                    pricingValidationStatus="MISSING_PRICING_DATA",
                    customerTargetPrice=None,
                    concessionGrantedPct=0.0,
                    productionCostPerUnit=fin.productionCostPerUnit,
                    approvalNotes="Quotation pricing data incomplete; escalated to costing department.",
                )
                return ClientAssistantInternalResponse(
                    success=True,
                    agent="client_assistant_agent",
                    conversationId=request.conversationId or "CONV-INCOMPLETE",
                    customerId=request.customerId,
                    quotationId=request.quotationId,
                    intent=CustomerIntent.GENERAL_QUERY,
                    negotiationStatus=NegotiationStatus.PENDING_APPROVAL,
                    customerResponse=customer_view,
                    salesOrderId=None,
                    orderCreationStatus=None,
                    internalMetadata=internal_meta,
                    timestamp=now_ts,
                    response=msg,
                    originalPricePerUnit=original_price,
                    currentOfferPerUnit=original_price,
                    customerTargetPrice=None,
                    minimumAuthorizedPrice=min_authorized_price,
                    requiresApproval=True,
                    pendingApprovalId=None,
                    suggestedAlternatives=None,
                )

        # STEP 4: Load or initialize persistent conversation state
        conv_state = self.conversation_repo.get_or_create(
            conversation_id=request.conversationId,
            tenant_id=request.tenantId,
            customer_id=request.customerId,
            quotation_id=request.quotationId,
            original_price_per_unit=original_price,
            minimum_authorized_price=min_authorized_price,
        )

        # STEP 5: Receive and interpret customer message, classify intent, extract entities
        intent, entities = self.intent_classifier.classify_and_extract(
            message=request.message,
            current_price=conv_state.current_offer_per_unit,
        )

        # Record incoming customer message
        conv_state.add_message(
            sender=SenderRole.CUSTOMER.value,
            message=request.message,
            intent=intent.value,
            metadata=entities,
        )

        # STEP 6: Customer Acceptance & Order Finalization Lifecycle
        sales_order_id: Optional[Union[str, int]] = None
        sales_order_number: Optional[str] = None
        order_creation_status: Optional[str] = None
        offer_expired = False
        quotation_mismatch = False

        if intent == CustomerIntent.ACCEPTANCE:
            accepted_offer, acceptance_code = conv_state.accept_active_offer(quotation_id=request.quotationId)
            if acceptance_code == "OFFER_EXPIRED":
                offer_expired = True
                conv_state.negotiation_status = NegotiationStatus.OFFER_EXPIRED
            elif acceptance_code == "QUOTATION_MISMATCH":
                quotation_mismatch = True
                conv_state.negotiation_status = NegotiationStatus.IN_PROGRESS
            elif acceptance_code == "ACCEPTED" and accepted_offer:
                quotation.status = QuotationStatus.APPROVED
                self.quotation_repo.save(quotation)

                # Invoke sales order creation workflow
                simulate_failure = bool(request.additionalContext and request.additionalContext.get("simulateOrderFailure"))
                order_result = self.sales_order_service.create_sales_order(
                    quotation=quotation,
                    offer=accepted_offer,
                    customer_profile=customer_profile,
                    simulate_failure=simulate_failure,
                )
                order_creation_status = order_result.status
                if order_result.success:
                    sales_order_id = order_result.orderId
                    sales_order_number = order_result.orderNumber
                else:
                    sales_order_id = None
                    sales_order_number = None

        # Check cumulative discount condition (already at authorized floor)
        is_already_at_floor = (
            conv_state.current_offer_per_unit <= min_authorized_price
            and conv_state.negotiation_status in (NegotiationStatus.OFFER_MADE, NegotiationStatus.IN_PROGRESS)
        )

        # STEP 7: Evaluate bargaining logic against authorized limits
        if offer_expired:
            decision = BargainingDecision(
                new_status=NegotiationStatus.OFFER_EXPIRED,
                current_offer_per_unit=conv_state.current_offer_per_unit,
                customer_target_price=None,
                minimum_authorized_price=min_authorized_price,
                requires_approval=False,
                concession_granted_pct=((original_price - conv_state.current_offer_per_unit) / original_price) * 100 if original_price > 0 else 0.0,
                negotiation_notes="Customer attempted to accept expired offer. Blocked acceptance.",
            )
        elif quotation_mismatch:
            decision = BargainingDecision(
                new_status=NegotiationStatus.IN_PROGRESS,
                current_offer_per_unit=conv_state.current_offer_per_unit,
                customer_target_price=None,
                minimum_authorized_price=min_authorized_price,
                requires_approval=False,
                concession_granted_pct=((original_price - conv_state.current_offer_per_unit) / original_price) * 100 if original_price > 0 else 0.0,
                negotiation_notes="Customer attempted to accept offer from different quotation.",
            )
        else:
            decision = self.bargaining_service.evaluate_negotiation_step(
                quotation=quotation,
                customer_profile=customer_profile,
                intent=intent,
                entities=entities,
                current_status=conv_state.negotiation_status,
                current_offer=conv_state.current_offer_per_unit,
                minimum_authorized_price=min_authorized_price,
            )

        # Update conversation state with bargaining evaluation
        conv_state.negotiation_status = decision.new_status
        conv_state.current_offer_per_unit = decision.current_offer_per_unit
        if decision.customer_target_price is not None:
            conv_state.customer_target_price = decision.customer_target_price

        # Handle Rejection
        if intent == CustomerIntent.REJECTION:
            conv_state.decline_active_offer()

        # STEP 8: If outside limits, request human approval
        pending_approval_id: Optional[str] = conv_state.pending_approval_id
        if decision.requires_approval and not conv_state.pending_approval_id:
            approval_rec = self.conversation_repo.create_pending_approval(
                conversation_id=conv_state.conversation_id,
                tenant_id=request.tenantId,
                customer_id=request.customerId,
                quotation_id=request.quotationId,
                requested_price_per_unit=decision.customer_target_price or decision.current_offer_per_unit,
                original_price_per_unit=original_price,
                minimum_authorized_price=min_authorized_price,
                reason=decision.escalation_reason or "Customer target price requires managerial approval.",
            )
            pending_approval_id = approval_rec.approvalId
            conv_state.requires_approval = True
            conv_state.pending_approval_id = pending_approval_id
        elif decision.requires_approval:
            conv_state.requires_approval = True
        else:
            conv_state.requires_approval = False

        # STEP 9: Counter-Offer matching & formal offer generation
        active_offer = conv_state.get_active_offer()
        is_exact_offer_match = False
        if active_offer and active_offer.offerStatus == OfferStatus.ACTIVE:
            target_p = decision.customer_target_price
            if target_p is not None and abs(active_offer.revisedPricePerUnit - target_p) < 0.01:
                is_exact_offer_match = True
            elif intent == CustomerIntent.DISCOUNT_REQUEST and abs(decision.current_offer_per_unit - active_offer.revisedPricePerUnit) < 0.01 and conv_state.negotiation_status == NegotiationStatus.OFFER_MADE:
                is_exact_offer_match = True

        # Only create a new offer when a genuinely different authorized commercial offer is presented
        if (
            decision.new_status == NegotiationStatus.OFFER_MADE
            and decision.current_offer_per_unit < original_price
            and not is_exact_offer_match
        ):
            if not active_offer or abs(active_offer.revisedPricePerUnit - decision.current_offer_per_unit) >= 0.01:
                offer_id = self.conversation_repo.generate_offer_id()
                active_offer = conv_state.create_offer(
                    offer_id=offer_id,
                    quotation_id=request.quotationId,
                    original_price=original_price,
                    revised_price=decision.current_offer_per_unit,
                    quantity=quotation.quantity,
                    validity_days=15,
                )

        # Deterministic financial calculations
        original_quotation_total = round(original_price * quotation.quantity, 2)
        revised_quotation_total = round(conv_state.current_offer_per_unit * quotation.quantity, 2)
        total_savings = round(original_quotation_total - revised_quotation_total, 2)
        discount_pct = (
            round(((original_price - conv_state.current_offer_per_unit) / original_price) * 100.0, 2)
            if original_price > 0
            else 0.0
        )

        # Tax calculations
        tax_amount: Optional[float] = None
        final_payable_amount: Optional[float] = None
        final_total_with_tax: Optional[float] = None
        tax_status = "TAX_NOT_CALCULATED"

        if fin.totalTax and fin.totalTax > 0 and fin.sellingPriceBeforeTax and fin.sellingPriceBeforeTax > 0:
            tax_rate = fin.totalTax / fin.sellingPriceBeforeTax
            tax_amount = round(revised_quotation_total * tax_rate, 2)
            final_payable_amount = round(revised_quotation_total + tax_amount, 2)
            final_total_with_tax = final_payable_amount
            tax_status = "CALCULATED"
        else:
            tax_status = "TAX_NOT_CALCULATED"
            tax_amount = None
            final_payable_amount = None
            final_total_with_tax = None

        # Generate objection context and value arguments
        objection_ctx = self.objection_handler.generate_objection_context(
            quotation=quotation,
            customer_profile=customer_profile,
            intent=intent,
            customer_message=request.message,
            current_offer=conv_state.current_offer_per_unit,
            minimum_authorized=min_authorized_price,
            target_price=conv_state.customer_target_price,
        )

        # Generate feasibility-backed alternatives when target price is unmet or objection raised
        suggested_alternatives: Optional[List[AlternativeRecommendation]] = None
        if (
            decision.requires_approval
            or is_already_at_floor
            or intent in (CustomerIntent.PRICE_OBJECTION, CustomerIntent.PRODUCT_CHANGE_REQUEST, CustomerIntent.COUNTER_OFFER)
        ):
            suggested_alternatives = self.alternative_service.generate_alternatives(
                quotation=quotation,
                customer_profile=customer_profile,
                target_price=conv_state.customer_target_price,
                current_offer_price=conv_state.current_offer_per_unit,
            )

        # STEP 10: Generate customer-facing response text
        if quotation_mismatch:
            response_text = (
                f"Hello {customer_profile.customerName},\n\n"
                f"The offer you are referencing belongs to a different quotation record and cannot be accepted for "
                f"quotation {request.quotationId}. Please verify the quotation identifier."
            )
        else:
            explanation_ctx = {
                "customerName": customer_profile.customerName,
                "companyName": customer_profile.companyName,
                "productName": quotation.productName,
                "quantity": quotation.quantity,
                "customerMessage": request.message,
                "intent": intent.value,
                "originalPricePerUnit": original_price,
                "currentOfferPerUnit": conv_state.current_offer_per_unit,
                "customerTargetPrice": conv_state.customer_target_price,
                "minimumAuthorizedPrice": min_authorized_price,
                "negotiationStatus": conv_state.negotiation_status.value,
                "requiresApproval": conv_state.requires_approval,
                "leadTimeDays": quotation.estimatedLeadTimeDays or 14,
                "paymentTerms": customer_profile.paymentTerms,
                "validityDays": 15,
                "offerExpiresAt": active_offer.expiresAt if active_offer else "",
                "originalQuotationTotal": original_quotation_total,
                "revisedQuotationTotal": revised_quotation_total,
                "totalSavings": total_savings,
                "taxStatus": tax_status,
                "taxAmount": tax_amount,
                "finalPayableAmount": final_payable_amount,
                "offerExpired": offer_expired,
                "isAlreadyAtFloor": is_already_at_floor,
                "isExactOfferMatch": is_exact_offer_match,
                "orderCreationStatus": order_creation_status,
                "salesOrderId": sales_order_id,
                "salesOrderNumber": sales_order_number,
                "valueDrivers": objection_ctx.get("valueDrivers", []),
                "suggestedAction": objection_ctx.get("proposedAction", ""),
            }
            response_text = self.explanation_service.generate_response(explanation_ctx)

        # Record response in conversation memory
        conv_state.add_message(
            sender=SenderRole.AGENT.value,
            message=response_text,
            intent=intent.value,
            metadata={
                "currentOfferPerUnit": conv_state.current_offer_per_unit,
                "negotiationStatus": conv_state.negotiation_status.value,
                "requiresApproval": conv_state.requires_approval,
                "salesOrderId": sales_order_id,
            },
        )

        # Assemble separated Customer View
        customer_view = CustomerOfferView(
            message=response_text,
            offerId=active_offer.offerId if active_offer else None,
            originalPricePerUnit=round(original_price, 2),
            revisedPricePerUnit=round(conv_state.current_offer_per_unit, 2),
            orderQuantity=quotation.quantity,
            originalQuotationTotal=original_quotation_total,
            revisedQuotationTotal=revised_quotation_total,
            totalSavings=total_savings,
            discountPercentage=discount_pct,
            taxStatus=tax_status,
            subtotalAmount=revised_quotation_total,
            taxAmount=tax_amount,
            finalQuotationTotalWithTax=final_total_with_tax,
            finalPayableAmount=final_payable_amount,
            offerExpiresAt=active_offer.expiresAt if active_offer else None,
            suggestedAlternatives=suggested_alternatives,
        )

        # If customer-facing view requested, omit all internal metadata
        if not include_internal:
            return ClientAssistantCustomerResponse(
                success=True,
                agent="client_assistant_agent",
                conversationId=conv_state.conversation_id,
                customerId=request.customerId,
                quotationId=request.quotationId,
                intent=intent,
                negotiationStatus=conv_state.negotiation_status,
                customerResponse=customer_view,
                salesOrderId=sales_order_id,
                orderCreationStatus=order_creation_status,
                timestamp=now_ts,
            )

        # Otherwise return authorized internal view with metadata
        internal_meta = InternalNegotiationMetadata(
            minimumAuthorizedPrice=min_authorized_price,
            requiresApproval=conv_state.requires_approval,
            pendingApprovalId=pending_approval_id,
            pricingValidationStatus="VALID",
            customerTargetPrice=conv_state.customer_target_price,
            concessionGrantedPct=discount_pct,
            productionCostPerUnit=fin.productionCostPerUnit,
            approvalNotes=decision.negotiation_notes,
        )

        return ClientAssistantInternalResponse(
            success=True,
            agent="client_assistant_agent",
            conversationId=conv_state.conversation_id,
            customerId=request.customerId,
            quotationId=request.quotationId,
            intent=intent,
            negotiationStatus=conv_state.negotiation_status,
            customerResponse=customer_view,
            salesOrderId=sales_order_id,
            orderCreationStatus=order_creation_status,
            internalMetadata=internal_meta,
            timestamp=now_ts,
            # Backward-compatible attributes
            response=response_text,
            originalPricePerUnit=round(original_price, 2),
            currentOfferPerUnit=round(conv_state.current_offer_per_unit, 2),
            customerTargetPrice=conv_state.customer_target_price,
            minimumAuthorizedPrice=round(min_authorized_price, 2),
            requiresApproval=conv_state.requires_approval,
            pendingApprovalId=pending_approval_id,
            suggestedAlternatives=suggested_alternatives,
        )

    def get_conversation(self, conversation_id: str, tenant_id: str = "tenant_default") -> ConversationDetailResponse:
        """Retrieve conversation history with tenant isolation."""
        conv = self.conversation_repo.get(conversation_id, tenant_id=tenant_id)
        return conv.to_detail_response()

    def list_conversations(
        self,
        tenant_id: str = "tenant_default",
        customer_id: Optional[int] = None,
    ) -> List[ConversationDetailResponse]:
        """Query conversations matching tenant and optional customer filters."""
        convs = self.conversation_repo.list_conversations(tenant_id=tenant_id, customer_id=customer_id)
        return [c.to_detail_response() for c in convs]

    def list_pending_approvals(self, tenant_id: str = "tenant_default") -> List[PendingApprovalRecord]:
        """List active managerial escalation requests."""
        return self.conversation_repo.list_pending_approvals(tenant_id=tenant_id)

    def decide_approval(
        self,
        approval_id: str,
        authorized_by: str,
        decision: str,
        approved_price_per_unit: Optional[float] = None,
        notes: Optional[str] = None,
        tenant_id: str = "tenant_default",
    ) -> HumanApprovalResponse:
        """
        Record managerial approval or rejection for an escalated negotiation.
        The AI agent never approves its own commercial exceptions.
        """
        rec = self.conversation_repo.record_approval_decision(
            approval_id=approval_id,
            authorized_by=authorized_by,
            decision=decision,
            approved_price_per_unit=approved_price_per_unit,
            notes=notes,
            tenant_id=tenant_id,
        )

        effective_price = approved_price_per_unit or rec.requestedPricePerUnit
        action_msg = (
            f"Approval '{approval_id}' successfully {rec.status} by '{authorized_by}'."
        )

        return HumanApprovalResponse(
            success=True,
            agent="client_assistant_agent",
            approvalId=approval_id,
            conversationId=rec.conversationId,
            quotationId=rec.quotationId,
            status=rec.status,
            decision=decision.upper(),
            decidedBy=authorized_by,
            effectivePricePerUnit=effective_price,
            message=action_msg,
            timestamp=rec.decisionTimestamp or datetime.now().isoformat(),
        )

    def get_alternatives(
        self,
        tenant_id: str,
        customer_id: int,
        quotation_id: str,
        target_price: Optional[float] = None,
    ) -> AlternativesResponse:
        """Generate feasibility-validated product and quantity alternatives."""
        customer_profile = self.customer_service.get_customer_profile(customer_id)
        quotation = self.customer_service.get_quotation_for_customer(
            quotation_identifier=quotation_id,
            customer_id=customer_id,
            tenant_id=tenant_id,
        )
        fin = quotation.financialSummary
        orig_price = float(
            fin.sellingPricePerUnit
            or (fin.finalQuotationAmount / max(1, quotation.quantity))
            or 250.0
        )

        alts = self.alternative_service.generate_alternatives(
            quotation=quotation,
            customer_profile=customer_profile,
            target_price=target_price,
        )

        return AlternativesResponse(
            success=True,
            agent="client_assistant_agent",
            quotationId=quotation_id,
            originalPricePerUnit=orig_price,
            targetPricePerUnit=target_price,
            alternatives=alts,
        )


_client_assistant_agent_instance: Optional[ClientAssistantAgent] = None


def get_client_assistant_agent() -> ClientAssistantAgent:
    """Return singleton instance of ClientAssistantAgent."""
    global _client_assistant_agent_instance
    if _client_assistant_agent_instance is None:
        _client_assistant_agent_instance = ClientAssistantAgent()
    return _client_assistant_agent_instance

