from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

from app.core.logging import get_logger
from app.data.data_repository import DataRepository, get_data_repository
from app.schemas.supplier_assistant_schema import (
    InternalProcurementMetadata,
    ProcurementBenchmark,
    SupplierApprovalView,
    SupplierChatRequest,
    SupplierChatResponse,
    SupplierNegotiationIntent,
    SupplierNegotiationStatus,
    SupplierOfferView,
)
from app.agents.supplier_assistant.conversation_repository import (
    SupplierConversationRepository,
    get_supplier_conversation_repository,
)
from app.agents.supplier_assistant.intent_classifier import SupplierIntentClassifier
from app.agents.supplier_assistant.procurement_pricing_service import ProcurementPricingService
from app.agents.supplier_assistant.supplier_explanation_service import SupplierExplanationService
from app.agents.supplier_assistant.supplier_negotiator import SupplierNegotiator
from app.agents.supplier_assistant.supplier_service import SupplierService

logger = get_logger(__name__)


class MaterialSupplierAssistantAgent:
    """
    LoomPilot Material Supplier Assistant Agent.
    Represents LoomPilot in commercial raw material procurement negotiations.
    Safeguards factory margins, benchmarks against spot market data, prevents
    unapproved cost creep, enforces quality BOM standards, and respects strict confidentiality.
    """

    def __init__(
        self,
        repository: Optional[DataRepository] = None,
        supplier_service: Optional[SupplierService] = None,
        pricing_service: Optional[ProcurementPricingService] = None,
        conversation_repo: Optional[SupplierConversationRepository] = None,
        intent_classifier: Optional[SupplierIntentClassifier] = None,
        negotiator: Optional[SupplierNegotiator] = None,
        explanation_service: Optional[SupplierExplanationService] = None,
    ):
        self.data_repository = repository or get_data_repository()
        self.supplier_service = supplier_service or SupplierService(self.data_repository)
        self.pricing_service = pricing_service or ProcurementPricingService()
        self.conversation_repo = conversation_repo or get_supplier_conversation_repository()
        self.intent_classifier = intent_classifier or SupplierIntentClassifier()
        self.negotiator = negotiator or SupplierNegotiator(self.pricing_service)
        self.explanation_service = explanation_service or SupplierExplanationService()

    def get_procurement_benchmark(self, material_id: Union[int, str]) -> ProcurementBenchmark:
        """Retrieve factual market and inventory benchmark for a given raw material."""
        mat = self.supplier_service.resolve_material(material_id)
        mid = mat["materialId"]
        rec_price = mat["unitPrice"]
        market_meta = self.supplier_service.get_market_price_benchmark(mid)
        spot_price = float(market_meta.get("marketSpotPrice", rec_price))
        inv_status = self.supplier_service.get_inventory_status(mid)

        target_price, max_ceiling = self.pricing_service.calculate_procurement_bounds(
            material_id=mid,
            recorded_price=rec_price,
            market_spot_price=spot_price,
        )

        sup_profile = self.supplier_service.get_supplier_profile(mat["preferredSupplierId"])

        return ProcurementBenchmark(
            materialId=mid,
            materialName=mat["materialName"],
            unit=mat["unit"],
            recordedUnitPriceINR=rec_price,
            marketSpotPriceINR=spot_price,
            marketPriceTrend=str(market_meta.get("trend", "STABLE")),
            market30DayChangePct=float(market_meta.get("changePct30d", 0.0)),
            currentStock=inv_status["currentStock"],
            committedStock=inv_status["committedStock"],
            netAvailableStock=inv_status["netAvailableStock"],
            preferredSupplierId=mat["preferredSupplierId"],
            preferredSupplierName=sup_profile["supplierName"],
            targetPurchasePriceINR=target_price,
            maxAuthorizedProcurementPriceINR=max_ceiling,
            inventorySufficient=inv_status["inventorySufficient"],
        )

    def process_chat(self, request: SupplierChatRequest) -> SupplierChatResponse:
        """
        Execute full procurement negotiation turn with supplier.
        """
        # 1. Resolve material & supplier profiles
        mat = self.supplier_service.resolve_material(request.materialId)
        mid = mat["materialId"]
        mat_name = mat["materialName"]
        unit = request.unit or mat["unit"]
        recorded_price = mat["unitPrice"]

        supplier_info = self.supplier_service.get_supplier_profile(request.supplierId)
        supplier_name = supplier_info["supplierName"]

        # 2. Retrieve conversation state
        conv_state = self.conversation_repo.get_or_create(
            conversation_id=request.conversationId,
            supplier_id=request.supplierId,
            material_id=mid,
        )

        # 3. Intent classification and entity extraction
        intent, entities = self.intent_classifier.classify_and_extract(
            message=request.message,
            current_counter_price=conv_state.last_counter_price,
        )

        # Overwrite with explicit request parameters if provided
        if request.offeredPricePerUnit is not None:
            entities["offeredPrice"] = request.offeredPricePerUnit
        if request.quantity is not None:
            entities["quantity"] = request.quantity
        if request.paymentTerms is not None:
            entities["paymentTerms"] = request.paymentTerms
        if request.proposedGsm is not None:
            entities["proposedGsm"] = request.proposedGsm

        # 4. Market price & inventory benchmarks
        market_meta = self.supplier_service.get_market_price_benchmark(mid)
        market_spot_price = float(market_meta.get("marketSpotPrice", recorded_price))
        inv_status = self.supplier_service.get_inventory_status(mid, entities.get("quantity", 0))

        # 5. Calculate procurement bounds
        target_price, max_ceiling = self.pricing_service.calculate_procurement_bounds(
            material_id=mid,
            recorded_price=recorded_price,
            market_spot_price=market_spot_price,
        )

        # 6. Execute negotiation state machine
        decision = self.negotiator.evaluate_step(
            material_id=mid,
            material_name=mat_name,
            unit=unit,
            recorded_price=recorded_price,
            market_spot_price=market_spot_price,
            target_price=target_price,
            max_ceiling=max_ceiling,
            intent=intent,
            entities=entities,
            current_status=conv_state.status,
            active_offer=conv_state.active_offer,
            default_quantity=float(request.quantity or 1000.0),
        )

        # 7. Handle approval escalation if needed
        pending_approval_id: Optional[str] = None
        if decision.requires_approval:
            approval_view = self.conversation_repo.create_approval_request(
                conversation_id=request.conversationId,
                supplier_id=request.supplierId,
                supplier_name=supplier_name,
                material_id=mid,
                material_name=mat_name,
                quantity=decision.quantity,
                unit=unit,
                supplier_quoted_price=decision.supplier_quoted_price or max_ceiling,
                max_authorized_price=max_ceiling,
                target_price=target_price,
                reason=decision.escalation_reason or "Exceeded procurement ceiling.",
            )
            pending_approval_id = approval_view.approvalId

        # 8. Record active offer in repository
        active_offer: Optional[SupplierOfferView] = None
        if decision.loompilot_counter_price is not None or decision.supplier_quoted_price is not None:
            active_offer = self.conversation_repo.set_active_offer(
                conversation_id=request.conversationId,
                material_id=mid,
                material_name=mat_name,
                quantity=decision.quantity,
                unit=unit,
                supplier_price=decision.supplier_quoted_price or recorded_price,
                counter_price=decision.loompilot_counter_price,
                payment_terms=decision.payment_terms,
                status=decision.new_status,
            )

        # 9. Record messages in thread history
        self.conversation_repo.record_message(
            conversation_id=request.conversationId,
            sender="SUPPLIER",
            text=request.message,
            intent=intent.value,
        )

        # 10. Generate B2B procurement response text
        context_data = {
            "supplierName": supplier_name,
            "materialName": mat_name,
            "quantity": decision.quantity,
            "unit": unit,
            "supplierMessage": request.message,
            "intent": intent.value,
            "negotiationStatus": decision.new_status.value,
            "supplierQuotedPrice": decision.supplier_quoted_price,
            "loompilotCounterPrice": decision.loompilot_counter_price,
            "recordedUnitPrice": recorded_price,
            "marketSpotPrice": market_spot_price,
            "requiresApproval": decision.requires_approval,
            "shortageVerified": decision.shortage_verified,
            "proposedGsm": entities.get("proposedGsm", 160),
            "requiredGsm": 180,
            "bulkPrice": entities.get("bulkPrice"),
            "bulkQuantity": entities.get("bulkQuantity"),
            "basePrice": entities.get("basePrice"),
            "cashDiscountPct": 2.0,
            "earlyPaymentDays": 15,
            "negotiatedPrice": decision.loompilot_counter_price,
        }

        response_text = self.explanation_service.generate_response(context_data)

        # Record agent's response
        self.conversation_repo.record_message(
            conversation_id=request.conversationId,
            sender="AGENT",
            text=response_text,
            intent=intent.value,
        )

        # 11. Internal metadata construction (Confidential)
        internal_metadata: Optional[InternalProcurementMetadata] = None
        if request.includeInternalMetadata:
            internal_metadata = InternalProcurementMetadata(
                targetPurchasePriceINR=target_price,
                maxAuthorizedProcurementPriceINR=max_ceiling,
                recordedUnitPriceINR=recorded_price,
                marketSpotPriceINR=market_spot_price,
                currentStock=inv_status["currentStock"],
                inventorySufficient=inv_status["inventorySufficient"],
                marketVerificationNote=(
                    f"Market 30-day trend: {market_meta.get('trend', 'STABLE')} "
                    f"({market_meta.get('changePct30d', 0.0):+.1f}% change)."
                ),
                qualityCheckPassed=decision.quality_check_passed,
                qualityNotes=decision.quality_notes,
                requiresApproval=decision.requires_approval,
                pendingApprovalId=pending_approval_id,
                escalationReason=decision.escalation_reason,
            )

        return SupplierChatResponse(
            success=True,
            agent="material_supplier_assistant",
            conversationId=request.conversationId,
            supplierId=request.supplierId,
            supplierName=supplier_name,
            materialId=mid,
            materialName=mat_name,
            intent=intent,
            negotiationStatus=decision.new_status,
            supplierQuotedPrice=decision.supplier_quoted_price,
            loompilotCounterPrice=decision.loompilot_counter_price,
            quantity=decision.quantity,
            unit=unit,
            paymentTermsNegotiated=decision.payment_terms,
            response=response_text,
            timestamp=datetime.now(timezone.utc).isoformat(),
            activeOffer=active_offer,
            internalMetadata=internal_metadata,
        )


_global_supplier_agent: Optional[MaterialSupplierAssistantAgent] = None


def get_material_supplier_assistant_agent() -> MaterialSupplierAssistantAgent:
    global _global_supplier_agent
    if _global_supplier_agent is None:
        _global_supplier_agent = MaterialSupplierAssistantAgent()
    return _global_supplier_agent

