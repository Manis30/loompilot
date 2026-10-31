from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import get_logger
from app.data.data_repository import DataRepository
from app.schemas.feasibility_schema import (
    FeasibilityIssue,
    FeasibilityRecommendation,
    MaterialCheckResult,
    MaterialItemAssessment,
    MaterialProcurementOption,
    SupplierLeadTimeInfo,
)

logger = get_logger(__name__)


class MaterialFeasibilityEvaluator:
    """
    Evaluates raw material feasibility by calculating product BOM consumption,
    accounting for validated cutting wastage, dynamic stock commitments,
    identifying inventory shortages, and factoring supplier procurement lead times.
    """

    def __init__(self, repository: DataRepository):
        self.repository = repository

    def evaluate(
        self,
        product_id: int,
        order_quantity: int,
        evaluation_date: date,
        committed_stock: Dict[int, float],
    ) -> Tuple[MaterialCheckResult, List[FeasibilityIssue], List[FeasibilityRecommendation]]:
        """
        Evaluate all materials required for an order.
        Returns:
            - MaterialCheckResult
            - List of FeasibilityIssues
            - List of FeasibilityRecommendations
        """
        bom = self.repository.get_product_bom(product_id)
        if not bom:
            # Missing BOM constraint
            issue = FeasibilityIssue(
                category="DATA_LIMITATION",
                severity="CRITICAL",
                resourceName=f"Product {product_id} BOM",
                title=f"Missing Bill of Materials (BOM) for Product ID {product_id}",
                reason="The catalog contains no verified recipe or component breakdown for this product.",
                actualAvailable="0 items",
                required="Verified BOM",
                shortage="Missing BOM configuration",
                explanation="Without an official BOM, precise fabric, thread, and accessory requirements cannot be calculated.",
                businessImpact="Manufacturing feasibility cannot be reliably determined. Order evaluation is halted.",
                recommendation="Register and approve the standard Bill of Materials for this product in the catalog.",
                estimatedResolutionDays=None,
                requiresAdminApproval=True,
            )
            result = MaterialCheckResult(
                status="INSUFFICIENT_DATA",
                isFeasible=False,
                summary="Bill of Materials (BOM) is not configured for this product. Material feasibility cannot be calculated.",
                materialsCount=0,
                shortagesCount=0,
                maxProcurementLeadTimeDays=0,
                materialAvailabilityDate=None,
                items=[],
            )
            return result, [issue], []

        items_assessments: List[MaterialItemAssessment] = []
        issues: List[FeasibilityIssue] = []
        recommendations: List[FeasibilityRecommendation] = []
        max_procurement_lead_time_days = 0
        total_existing_deficit = 0.0

        stage_dates_collector: Dict[str, List[Optional[date]]] = {}

        for bom_item in bom:
            mat_id = bom_item["materialId"]
            mat_name = bom_item["materialName"]
            unit = bom_item["unit"]
            process_stage = bom_item["processStage"]
            gross_per_unit = bom_item["grossConsumptionPerUnit"]
            wastage_pct = bom_item["wastageRatePct"]
            net_per_unit = bom_item["netConsumptionPerUnit"]

            gross_required = round(order_quantity * gross_per_unit, 2)

            # Retrieve catalog material
            mat_info = self.repository.get_material(mat_id)
            physical_stock = float(mat_info.get("CurrentStock", 0.0))
            committed = float(committed_stock.get(mat_id, 0.0))
            net_available = round(physical_stock - committed, 2)
            usable_stock = max(0.0, net_available)

            existing_deficit = max(0.0, round(committed - physical_stock, 2))
            total_existing_deficit += existing_deficit

            shortage = max(0.0, round(gross_required - usable_stock, 2))
            is_shortage = shortage > 0.001
            additional_procurement = shortage

            supplier_info = mat_info.get("supplier")
            supplier_lead_time_days: Optional[int] = None
            supplier_lead_info: Optional[SupplierLeadTimeInfo] = None

            if supplier_info:
                supplier_lead_time_days = int(supplier_info.get("LeadTimeDays", 4))
                supplier_lead_info = SupplierLeadTimeInfo(
                    supplierId=int(supplier_info.get("SupplierID", 0)),
                    supplierName=str(supplier_info.get("SupplierName", "Supplier")),
                    city=str(supplier_info.get("City", "")),
                    leadTimeDays=supplier_lead_time_days,
                )

            # Expected availability date calculation
            if is_shortage:
                if supplier_lead_time_days is not None:
                    avail_date = evaluation_date + timedelta(days=supplier_lead_time_days)
                    avail_date_str = avail_date.strftime("%Y-%m-%d")
                    if supplier_lead_time_days > max_procurement_lead_time_days:
                        max_procurement_lead_time_days = supplier_lead_time_days
                else:
                    avail_date = None
                    avail_date_str = None
            else:
                avail_date = evaluation_date
                avail_date_str = evaluation_date.strftime("%Y-%m-%d")

            if process_stage not in stage_dates_collector:
                stage_dates_collector[process_stage] = []
            stage_dates_collector[process_stage].append(avail_date)

            # Mutually exclusive procurement options
            proc_options: Dict[str, MaterialProcurementOption] = {}
            if is_shortage:
                factory_replenish = round(existing_deficit + shortage, 2)
                sup_name_opt = supplier_info.get("SupplierName", "Supplier") if supplier_info else "Catalog Supplier"
                lead_days_opt = supplier_lead_time_days or 4

                proc_options["NEW_ORDER_ONLY"] = MaterialProcurementOption(
                    scope="NEW_ORDER_ONLY",
                    quantity=shortage,
                    unit=unit,
                    supplierName=sup_name_opt,
                    estimatedLeadTimeDays=lead_days_opt,
                    isRecommended=True,
                    recommendationReason=f"Recommended for order fulfillment: Procures exact required batch shortage ({shortage:.2f} {unit}) with minimal working capital outlay.",
                    costImpactNote="Restricted strictly to newly requested order volume.",
                )
                if existing_deficit > 0.001:
                    proc_options["FACTORY_WIDE_REPLENISHMENT"] = MaterialProcurementOption(
                        scope="FACTORY_WIDE_REPLENISHMENT",
                        quantity=factory_replenish,
                        unit=unit,
                        supplierName=sup_name_opt,
                        estimatedLeadTimeDays=lead_days_opt,
                        isRecommended=False,
                        recommendationReason=(
                            f"Alternative factory replenishment: Covers pre-existing floor deficit ({existing_deficit:.2f} {unit}) "
                            f"plus new order ({shortage:.2f} {unit}). CRITICAL: This quantity already includes the new-order requirement; "
                            "DO NOT ADD BOTH OPTIONS TOGETHER."
                        ),
                        costImpactNote="Protects active WIP commitments from stockouts but requires higher immediate capital.",
                    )

            # Schedule impact evaluation accounting for stage dependencies and factory calendar
            sched_impact = None
            if is_shortage:
                if process_stage == "Cutting":
                    sched_impact = (
                        "Fabric transit directly gates Cutting start. A supplier transit delay shifts Cutting start date "
                        "and may cascade across subsequent factory working days (excluding Sunday weekly off), requiring timeline recalculation."
                    )
                else:
                    sched_impact = (
                        f"Material {mat_name} is required for {process_stage}. With estimated delivery on {avail_date_str}, "
                        f"supplier delays will not impact final completion provided delivery occurs before {process_stage} commences; "
                        "if arrival exceeds stage start, overall delivery will shift accordingly."
                    )

            item_assessment = MaterialItemAssessment(
                materialId=mat_id,
                materialName=mat_name,
                unit=unit,
                processStage=process_stage,
                netConsumptionPerUnit=net_per_unit,
                wastageRatePct=wastage_pct,
                grossConsumptionPerUnit=gross_per_unit,
                requiredQuantity=gross_required,
                physicalStock=physical_stock,
                currentStock=physical_stock,
                committedStock=committed,
                netAvailableStock=net_available,
                usableAvailableStock=usable_stock,
                existingCommitmentDeficit=existing_deficit,
                shortageQuantity=shortage,
                newOrderRequirement=gross_required,
                newOrderProcurementQuantity=shortage,
                factoryWideReplenishmentQuantity=round(existing_deficit + shortage, 2),
                procurementScope="NEW_ORDER_ONLY" if existing_deficit == 0 else "MUTUALLY_EXCLUSIVE_CHOICE",
                procurementOptions=proc_options,
                selectedProcurementOption="NEW_ORDER_ONLY" if is_shortage else None,
                procurementChoiceInstruction=(
                    "MUTUALLY EXCLUSIVE OPTIONS: Choose either Option A (New-Order Only) OR Option B (Factory-Wide Replenishment). "
                    "Do not sum or purchase both quantities."
                ) if is_shortage and existing_deficit > 0.001 else None,
                procurementConfirmationStatus="UNCONFIRMED_ESTIMATE (Based on catalog supplier lead time; no active Purchase Order confirmed)",
                scheduleImpactIfDelayed=sched_impact,
                additionalProcurementQuantity=additional_procurement,
                isShortage=is_shortage,
                supplier=supplier_lead_info,
                procurementLeadTimeDays=supplier_lead_time_days if is_shortage else 0,
                expectedAvailabilityDate=avail_date_str,
                isProcurementConfirmed=False,
                notes=(
                    f"Shortage of {shortage:.2f} {unit}. Estimated supplier lead time is {supplier_lead_time_days} days (Unconfirmed estimate)."
                    if is_shortage else f"Sufficient unallocated inventory available ({usable_stock:.2f} {unit})."
                ),
            )
            items_assessments.append(item_assessment)

            # Consolidate material shortage into a single issue per material
            if is_shortage:
                factory_replenish = round(existing_deficit + shortage, 2)
                # Stage-specific business impact
                if process_stage == "Cutting":
                    stage_impact = f"Fabric shortage directly blocks the Cutting stage. Production cannot begin until {mat_name} is delivered by supplier."
                elif process_stage == "Stitching":
                    stage_impact = f"Shortage affects the Stitching stage. Cutting can commence on schedule, but panel assembly requires {mat_name}."
                elif process_stage == "Packing":
                    stage_impact = f"Shortage affects the final Packing stage. Cutting, stitching, and finishing can proceed without delay, but garments cannot be bagged or boxed for dispatch until delivery."
                else:
                    stage_impact = f"Shortage affects the {process_stage} stage."

                if supplier_info:
                    sup_name = supplier_info.get("SupplierName", "Supplier")
                    sup_city = supplier_info.get("City", "")
                    lead_days = supplier_lead_time_days or 4

                    issues.append(
                        FeasibilityIssue(
                            category="MATERIAL_SHORTAGE",
                            severity="HIGH",
                            resourceName=mat_name,
                            affectedResource=mat_name,
                            title=f"Material shortage & replenishment required for {mat_name}",
                            reason="Available unallocated stock is insufficient after accounting for existing production commitments.",
                            rootCause=(
                                f"Warehouse physical stock ({physical_stock:.2f} {unit}) is fully committed to active floor orders "
                                f"({committed:.2f} {unit}), resulting in a pre-existing deficit of {existing_deficit:.2f} {unit} "
                                f"plus new order requirement of {gross_required:.2f} {unit}."
                                if existing_deficit > 0.001 else
                                f"Unallocated warehouse inventory is insufficient after deducting existing factory commitments."
                            ),
                            affectedProductionStage=process_stage,
                            actualAvailable=f"{usable_stock:.2f} {unit} usable (Physical: {physical_stock:.2f}, Committed: {committed:.2f}, Existing deficit: {existing_deficit:.2f})",
                            actualAvailableQuantity=f"{usable_stock:.2f} {unit}",
                            required=f"{gross_required:.2f} {unit} for new order",
                            requiredQuantity=f"{gross_required:.2f} {unit}",
                            shortage=f"{shortage:.2f} {unit} (New Order) / {factory_replenish:.2f} {unit} (Factory-Wide)",
                            shortageQuantity=f"{shortage:.2f} {unit}",
                            existingCommitmentDeficit=existing_deficit,
                            newOrderShortage=shortage,
                            recommendedProcurementQuantity=shortage,
                            procurementScope=(
                                f"Option A [NEW_ORDER_ONLY]: {shortage:.2f} {unit} (Recommended) | "
                                f"Option B [FACTORY_WIDE_REPLENISHMENT]: {factory_replenish:.2f} {unit} (Includes Option A; do not add together)"
                                if existing_deficit > 0.001 else f"NEW_ORDER_ONLY: {shortage:.2f} {unit}"
                            ),
                            supplierName=sup_name,
                            estimatedLeadTimeDays=lead_days,
                            explanation=(
                                f"Warehouse currently has {physical_stock:.2f} {unit} of {mat_name}, of which {committed:.2f} {unit} "
                                f"is committed to active in-progress orders. The new order requires {gross_required:.2f} {unit} "
                                f"(incorporating {wastage_pct}% cutting allowance). "
                                + (f"Active orders already face an inventory deficit of {existing_deficit:.2f} {unit}. " if existing_deficit > 0.001 else "")
                                + f"Mutually exclusive options: Option A orders {shortage:.2f} {unit} strictly for this order. "
                                f"Option B orders {factory_replenish:.2f} {unit} to clear factory deficit as well. Choose one option only; never add both."
                            ),
                            businessImpact=stage_impact,
                            recommendation=(
                                f"Select ONE mutually exclusive procurement option: Option A (Recommended): Order {shortage:.2f} {unit} from {sup_name} strictly for this order. "
                                + (f"Option B: Order {factory_replenish:.2f} {unit} to clear factory deficit ({existing_deficit:.2f} {unit}) and fulfill this order. Do not purchase both." if existing_deficit > 0.001 else "")
                            ),
                            recommendedAction=f"Procure {shortage:.2f} {unit} from {sup_name} ({sup_city}) based on estimated supplier lead time of {lead_days} days (Unconfirmed estimate).",
                            estimatedResolutionDays=lead_days,
                            requiresAdminApproval=True,
                        )
                    )

                    # Unified single recommendation per material with clear mutually exclusive options
                    recommendations.append(
                        FeasibilityRecommendation(
                            category="PROCUREMENT",
                            priority="HIGH",
                            title=f"Procurement Selection for {mat_name} (Mutually Exclusive Options)",
                            action=(
                                f"Choose ONE of two mutually exclusive options for {mat_name}: "
                                f"Option A (Recommended for this order): Order {shortage:.2f} {unit} from {sup_name} ({sup_city}) based on estimated catalog lead time of {lead_days} days to satisfy this order. "
                                + (f"Option B (Factory-Wide Replenishment): Order {factory_replenish:.2f} {unit} to eliminate active floor deficit ({existing_deficit:.2f} {unit}) and satisfy new order. "
                                   "CRITICAL: Option B already includes Option A; DO NOT order both quantities." if existing_deficit > 0.001 else "")
                            ),
                            expectedImpact=f"Secures required raw material for {process_stage} stage by estimated date {avail_date_str} (Subject to Purchase Order confirmation).",
                            requiresAdminApproval=True,
                        )
                    )
                else:
                    # Material shortage without preferred supplier
                    issues.append(
                        FeasibilityIssue(
                            category="MATERIAL_SHORTAGE",
                            severity="CRITICAL",
                            resourceName=mat_name,
                            affectedResource=mat_name,
                            title=f"Material shortage without verified supplier for {mat_name}",
                            reason="Stock is insufficient and no preferred supplier record is assigned in the system.",
                            rootCause=f"Material {mat_name} has zero registered preferred supplier in catalog.",
                            affectedProductionStage=process_stage,
                            actualAvailable=f"{usable_stock:.2f} {unit}",
                            actualAvailableQuantity=f"{usable_stock:.2f} {unit}",
                            required=f"{gross_required:.2f} {unit}",
                            requiredQuantity=f"{gross_required:.2f} {unit}",
                            shortage=f"{shortage:.2f} {unit}",
                            shortageQuantity=f"{shortage:.2f} {unit}",
                            existingCommitmentDeficit=existing_deficit,
                            newOrderShortage=shortage,
                            recommendedProcurementQuantity=shortage,
                            procurementScope=f"NEW_ORDER_ONLY: {shortage:.2f} {unit}",
                            supplierName="None",
                            estimatedLeadTimeDays=None,
                            explanation=f"Need {gross_required:.2f} {unit}, but unallocated stock is only {usable_stock:.2f} {unit} and no approved supplier is listed to provide replenishment lead time.",
                            businessImpact=f"{stage_impact} Delivery date cannot be calculated without reliable procurement lead time.",
                            recommendation=f"Identify and onboard a qualified supplier for {mat_name} with confirmed lead times.",
                            recommendedAction=f"Onboard verified supplier for {mat_name}.",
                            estimatedResolutionDays=None,
                            requiresAdminApproval=True,
                        )
                    )

        # Stage material availability dates
        stage_mat_dates: Dict[str, Optional[str]] = {}
        for stg, dates in stage_dates_collector.items():
            if any(d is None for d in dates):
                stage_mat_dates[stg] = None
            else:
                valid_dates = [d for d in dates if d is not None]
                if valid_dates:
                    stage_mat_dates[stg] = max(valid_dates).strftime("%Y-%m-%d")
                else:
                    stage_mat_dates[stg] = evaluation_date.strftime("%Y-%m-%d")

        shortages_count = sum(1 for it in items_assessments if it.isShortage)
        if shortages_count == 0:
            status = "PASS"
            is_feasible = True
            mat_avail_date = evaluation_date.strftime("%Y-%m-%d")
            summary = "All required raw materials are fully available in warehouse unallocated inventory."
        else:
            # Check if any shortage has no supplier
            unresolvable = any(it.isShortage and it.supplier is None for it in items_assessments)
            if unresolvable:
                status = "FAIL"
                is_feasible = False
                mat_avail_date = None
                summary = f"Identified {shortages_count} material shortage(s), including items without verified supplier lead times."
            else:
                status = "WARNING"
                is_feasible = True
                mat_avail_date = (evaluation_date + timedelta(days=max_procurement_lead_time_days)).strftime("%Y-%m-%d")
                summary = (
                    f"Identified {shortages_count} material shortage(s). Materials can be procured within "
                    f"{max_procurement_lead_time_days} days from preferred suppliers, allowing production to proceed."
                )

        result = MaterialCheckResult(
            status=status,
            isFeasible=is_feasible,
            summary=summary,
            materialsCount=len(items_assessments),
            shortagesCount=shortages_count,
            totalExistingCommitmentDeficit=round(total_existing_deficit, 2),
            maxProcurementLeadTimeDays=max_procurement_lead_time_days,
            materialAvailabilityDate=mat_avail_date,
            stageMaterialAvailabilityDates=stage_mat_dates,
            items=items_assessments,
        )
        return result, issues, recommendations

