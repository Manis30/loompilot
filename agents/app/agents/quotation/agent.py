from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Union

from app.core.logging import get_logger
from app.data.data_repository import DataRepository, get_data_repository
from app.schemas.quotation_schema import (
    AdditionalCostBreakdown,
    AdditionalCostItem,
    CostComponentStatus,
    PricingMethod,
    ProductDetails,
    QuotationCostBreakdown,
    QuotationDetail,
    QuotationFinancialSummary,
    QuotationGenerationRequest,
    QuotationResponse,
    QuotationStatus,
)
from app.agents.quotation.validator import QuotationValidator
from app.agents.quotation.bom_costing_service import BOMCostingService
from app.agents.quotation.labour_costing_service import LabourCostingService
from app.agents.quotation.machine_costing_service import MachineCostingService
from app.agents.quotation.overhead_costing_service import OverheadCostingService
from app.agents.quotation.pricing_service import PricingService
from app.agents.quotation.tax_service import TaxService
from app.agents.quotation.quotation_repository import (
    QuotationRepository,
    get_quotation_repository,
)
from app.agents.quotation.explanation_service import QuotationExplanationService

logger = get_logger(__name__)


class QuotationAgent:
    """
    Core Quotation AI Agent for LoomPilot manufacturing management platform.
    Orchestrates bottom-up costing across raw materials, labour, machine operating hours,
    manufacturing overhead, margin pricing, and statutory taxes.
    """

    def __init__(
        self,
        repository: Optional[DataRepository] = None,
        quotation_repository: Optional[QuotationRepository] = None,
        explanation_service: Optional[QuotationExplanationService] = None,
    ):
        self.repository = repository or get_data_repository()
        self.quotation_repo = quotation_repository or get_quotation_repository()
        self.validator = QuotationValidator(self.repository)
        self.bom_service = BOMCostingService(self.repository)
        self.labour_service = LabourCostingService(self.repository)
        self.machine_service = MachineCostingService(self.repository)
        self.overhead_service = OverheadCostingService()
        self.pricing_service = PricingService()
        self.tax_service = TaxService()
        self.explanation_service = explanation_service or QuotationExplanationService()

    def generate_quotation(self, request: QuotationGenerationRequest) -> QuotationResponse:
        """
        Execute full bottom-up costing pipeline and generate a structured quotation.
        """
        logger.info(
            f"Generating quotation for tenant='{request.tenantId}', client='{request.clientId}', "
            f"product='{request.productName or request.productId}', quantity={request.quantity}"
        )

        # 1. Validation & Input Resolution
        client_details, product_details = self.validator.validate_request(request)

        # 2. Material Costing via BOM & Market Price Agent
        materials_breakdown = self.bom_service.calculate_material_costs(
            product_id=product_details.productId,
            order_quantity=request.quantity,
            specifications=request.specifications,
        )

        # 3. Direct Labour Costing
        labour_breakdown = self.labour_service.calculate_labour_costs(
            stages=product_details.stages,
            order_quantity=request.quantity,
            labour_rate_overrides=request.labourRates,
        )

        # 4. Machine Operating Costing
        machine_breakdown = self.machine_service.calculate_machine_costs(
            stages=product_details.stages,
            order_quantity=request.quantity,
            machine_rate_overrides=request.machineRates,
        )

        # 5. Manufacturing Overhead Costing
        # If overheadConfig is explicitly provided or default applies
        overhead_breakdown = self.overhead_service.calculate_overhead(
            order_quantity=request.quantity,
            direct_material_cost=materials_breakdown.totalCost,
            direct_labour_cost=labour_breakdown.totalCost,
            total_labour_hours=labour_breakdown.totalLabourHours,
            total_machine_hours=machine_breakdown.totalMachineHours,
            config=request.overheadConfig,
            allow_default=True,
        )

        # 6. Additional Production Costs
        additional_items: List[AdditionalCostItem] = []
        total_additional_cost = 0.0

        if request.additionalCosts:
            for item in request.additionalCosts:
                c_type = str(item.get("costType", "Special Processing"))
                desc = str(item.get("description", "Customer requested additional operation"))
                basis = str(item.get("costBasis", "PER_UNIT"))
                rate_or_amt = float(item.get("rateOrAmount", 0.0))
                item_total = round(rate_or_amt * request.quantity, 2) if basis == "PER_UNIT" else round(rate_or_amt, 2)
                total_additional_cost += item_total
                additional_items.append(
                    AdditionalCostItem(
                        costType=c_type,
                        description=desc,
                        costBasis=basis,
                        rateOrAmount=rate_or_amt,
                        totalCost=item_total,
                        currency=request.currency,
                    )
                )

        additional_breakdown = AdditionalCostBreakdown(
            status=CostComponentStatus.COMPLETE,
            items=additional_items,
            totalCost=round(total_additional_cost, 2),
        )

        # Assemble full Cost Breakdown
        cost_breakdown = QuotationCostBreakdown(
            materials=materials_breakdown,
            labour=labour_breakdown,
            machine=machine_breakdown,
            overhead=overhead_breakdown,
            additionalCosts=additional_breakdown,
        )

        # 7. Total Production Cost Calculation
        total_prod_cost, prod_cost_per_unit = self.pricing_service.calculate_total_production_cost(
            material_cost=materials_breakdown.totalCost,
            labour_cost=labour_breakdown.totalCost,
            machine_cost=machine_breakdown.totalCost,
            overhead_cost=overhead_breakdown.totalCost,
            additional_cost=additional_breakdown.totalCost,
            order_quantity=request.quantity,
        )

        # 8. Commercial Margin & Selling Price Before Tax
        selling_price_before_tax, selling_price_per_unit, margin_amount = self.pricing_service.calculate_selling_price(
            total_production_cost=total_prod_cost,
            pricing_method=request.pricingMethod,
            margin_percentage=request.marginPercentage,
            order_quantity=request.quantity,
        )

        # 9. Statutory Taxes & Final Quotation Amount
        tax_items, total_tax, final_quotation_amount = self.tax_service.calculate_taxes(
            taxable_amount=selling_price_before_tax,
            tax_rate_percentage=request.taxRatePercentage,
            is_interstate=False,
            currency=request.currency,
        )

        final_amount_per_unit = (
            round(final_quotation_amount / request.quantity, 2)
            if final_quotation_amount is not None
            else None
        )

        financial_summary = QuotationFinancialSummary(
            currency=request.currency,
            totalMaterialCost=materials_breakdown.totalCost,
            totalLabourCost=labour_breakdown.totalCost,
            totalMachineCost=machine_breakdown.totalCost,
            totalOverheadCost=overhead_breakdown.totalCost,
            totalAdditionalCost=additional_breakdown.totalCost,
            totalProductionCost=total_prod_cost,
            productionCostPerUnit=prod_cost_per_unit,
            pricingMethod=request.pricingMethod.value,
            marginPercentage=request.marginPercentage,
            marginAmount=margin_amount,
            sellingPriceBeforeTax=selling_price_before_tax,
            sellingPricePerUnit=selling_price_per_unit,
            taxBreakdown=tax_items,
            totalTax=total_tax,
            finalQuotationAmount=final_quotation_amount,
            finalQuotationAmountPerUnit=final_amount_per_unit,
        )

        # 10. Audit Assumptions, Warnings, Missing Information
        assumptions: List[str] = [
            "BOM fabric consumption incorporates 5.0% validated cutting wastage allowance.",
            "Standard single-shift operating model (8 hours/day, 6 days/week) calibrated from factory attendance records.",
            "Raw material rates reflect latest verified weekly spot prices from Market Price Agent.",
            f"Overhead allocated via {overhead_breakdown.allocationMethod} methodology.",
        ]

        warnings: List[str] = []
        missing_information: List[str] = []

        # Check for missing components
        if materials_breakdown.status != CostComponentStatus.COMPLETE:
            missing_information.extend([f"Raw material price: {m}" for m in materials_breakdown.missingMaterials])
        if labour_breakdown.status != CostComponentStatus.COMPLETE:
            missing_information.extend([f"Labour rate for stage: {op}" for op in labour_breakdown.missingOperations])
        if machine_breakdown.status != CostComponentStatus.COMPLETE:
            missing_information.extend([f"Machine operating rate: {mach}" for mach in machine_breakdown.missingMachines])
        if overhead_breakdown.status != CostComponentStatus.COMPLETE:
            missing_information.append("Factory overhead allocation configuration is incomplete.")
        if request.marginPercentage is None:
            missing_information.append("Target commercial margin percentage is missing.")
        if request.taxRatePercentage is None:
            missing_information.append("Applicable tax rate structure is not configured.")

        # Check delivery date lead time feasibility
        est_lead_time_days = 14  # Standard lead time baseline
        if request.requestedDeliveryDate:
            req_date_str = str(request.requestedDeliveryDate)
            try:
                r_date = date.fromisoformat(req_date_str) if isinstance(req_date_str, str) else req_date_str
                today = date.today()
                days_avail = (r_date - today).days
                if days_avail < est_lead_time_days:
                    warnings.append(
                        f"Requested delivery date ({req_date_str}) allows only {days_avail} days, which is less than "
                        f"the standard manufacturing lead time of {est_lead_time_days} days. Expedited production required."
                    )
            except Exception:
                pass

        # 11. Determine Quotation Status
        if missing_information:
            status = QuotationStatus.PENDING_INFORMATION
        elif warnings:
            status = QuotationStatus.PENDING_REVIEW
        else:
            status = QuotationStatus.READY_FOR_APPROVAL

        # 12. Identifiers & Timestamps
        q_id, q_num = self.quotation_repo.generate_next_quotation_id()
        calc_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        valid_until = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")

        # 13. AI Explanation
        explanation_payload = {
            "quotationNumber": q_num,
            "clientName": client_details.clientName,
            "productName": product_details.productName,
            "quantity": request.quantity,
            "status": status.value,
            "financialSummary": financial_summary.model_dump(),
            "costBreakdown": cost_breakdown.model_dump(),
            "missingInformation": missing_information,
            "warnings": warnings,
            "assumptions": assumptions,
        }
        explanation_text = self.explanation_service.generate_explanation(explanation_payload)

        # 14. Build and Persist QuotationDetail
        quotation_detail = QuotationDetail(
            quotationId=q_id,
            quotationNumber=q_num,
            tenantId=request.tenantId,
            client=client_details,
            product=product_details,
            productName=product_details.productName,
            quantity=request.quantity,
            status=status,
            specifications=request.specifications or {},
            costBreakdown=cost_breakdown,
            financialSummary=financial_summary,
            assumptions=assumptions,
            warnings=warnings,
            missingInformation=missing_information,
            explanation=explanation_text,
            calculationTimestamp=calc_timestamp,
            validUntil=valid_until,
            requestedDeliveryDate=str(request.requestedDeliveryDate) if request.requestedDeliveryDate else None,
            estimatedLeadTimeDays=est_lead_time_days,
            approvalHistory=[],
        )

        self.quotation_repo.save(quotation_detail)

        return QuotationResponse(
            success=True,
            agent="quotation_agent",
            quotation=quotation_detail,
            message=f"Quotation {q_num} generated with status {status.value}.",
        )

    def get_quotation(self, quotation_identifier: str, tenant_id: Optional[str] = None) -> QuotationDetail:
        """Retrieve quotation with tenant isolation."""
        return self.quotation_repo.get(quotation_identifier, tenant_id=tenant_id)

    def list_quotations(
        self,
        tenant_id: Optional[str] = None,
        status: Optional[QuotationStatus] = None,
    ) -> List[QuotationDetail]:
        """List quotations with optional tenant and status filters."""
        return self.quotation_repo.list_quotations(tenant_id=tenant_id, status=status)

    def approve_quotation(
        self,
        quotation_identifier: str,
        authorized_by: str,
        approval_notes: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> QuotationDetail:
        """Approve a quotation with authorized manager credentials."""
        return self.quotation_repo.approve(
            quotation_identifier=quotation_identifier,
            authorized_by=authorized_by,
            approval_notes=approval_notes,
            tenant_id=tenant_id,
        )

    def reject_quotation(
        self,
        quotation_identifier: str,
        rejected_by: str,
        rejection_reason: str,
        tenant_id: Optional[str] = None,
    ) -> QuotationDetail:
        """Reject a quotation with recorded reason."""
        return self.quotation_repo.reject(
            quotation_identifier=quotation_identifier,
            rejected_by=rejected_by,
            rejection_reason=rejection_reason,
            tenant_id=tenant_id,
        )


_quotation_agent_instance: Optional[QuotationAgent] = None


def get_quotation_agent() -> QuotationAgent:
    """Return the global QuotationAgent singleton."""
    global _quotation_agent_instance
    if _quotation_agent_instance is None:
        _quotation_agent_instance = QuotationAgent()
    return _quotation_agent_instance

