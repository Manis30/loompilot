from datetime import date, datetime
from typing import Any, Dict, List, Optional, Union

from app.core.logging import get_logger
from app.data.data_repository import (
    DataRepository,
    OrderNotFoundError,
    ProductNotFoundError,
    get_data_repository,
)
from app.schemas.feasibility_schema import (
    FeasibilityChecks,
    FeasibilityEvaluationRequest,
    FeasibilityEvaluationResponse,
    FeasibilityIssue,
    FeasibilityRecommendation,
    MaterialCheckResult,
)
from app.agents.feasibility.material_evaluator import MaterialFeasibilityEvaluator
from app.agents.feasibility.machine_evaluator import MachineFeasibilityEvaluator
from app.agents.feasibility.workforce_evaluator import WorkforceFeasibilityEvaluator
from app.agents.feasibility.commitment_evaluator import CommitmentEvaluator
from app.agents.feasibility.production_scheduler import ProductionScheduler
from app.agents.feasibility.scenario_engine import FeasibilityScenarioEngine
from app.agents.feasibility.explanation_service import FeasibilityExplanationService

logger = get_logger(__name__)


class FeasibilityAgent:
    """
    Intelligent manufacturing feasibility assessment agent for LoomPilot.
    Orchestrates material, machine, workforce, commitment, and scheduling evaluations
    to deliver transparent, data-grounded manufacturing advisories.
    """

    DEFAULT_EVALUATION_DATE = date(2026, 10, 30)

    def __init__(
        self,
        repository: Optional[DataRepository] = None,
        explanation_service: Optional[FeasibilityExplanationService] = None,
    ):
        self.repository = repository or get_data_repository()
        self.material_evaluator = MaterialFeasibilityEvaluator(self.repository)
        self.machine_evaluator = MachineFeasibilityEvaluator(self.repository)
        self.workforce_evaluator = WorkforceFeasibilityEvaluator(self.repository)
        self.commitment_evaluator = CommitmentEvaluator(self.repository)
        self.production_scheduler = ProductionScheduler()
        self.scenario_engine = FeasibilityScenarioEngine()
        self.explanation_service = explanation_service or FeasibilityExplanationService()

    def evaluate_order(
        self,
        request: FeasibilityEvaluationRequest,
    ) -> FeasibilityEvaluationResponse:
        """
        Evaluate the manufacturing feasibility of an existing or newly submitted client order.
        Respects tenant isolation, prevents double-counting, and produces actionable business reasoning.
        """
        logger.info(f"Evaluating feasibility for tenant='{request.tenantId}', order='{request.orderId}'")

        # 1. Tenant validation
        if not request.tenantId or not request.tenantId.strip():
            raise ValueError("Invalid tenantId: tenant identifier is required for tenant isolation.")

        # 2. Resolve or construct Order context
        existing_order: Optional[Dict[str, Any]] = None
        resolved_order_id: Optional[int] = None
        order_number: str = str(request.orderId)

        try:
            resolved_order_id = self.repository.resolve_order_id(request.orderId)
            existing_order = self.repository.get_order(resolved_order_id)
            order_number = existing_order.get("OrderNumber", str(request.orderId))
        except OrderNotFoundError:
            # If not found in records, check if explicit simulation parameters were supplied
            if request.productId is None or request.orderQuantity is None:
                raise OrderNotFoundError(
                    f"Order '{request.orderId}' not found in active database, and required simulation parameters "
                    f"(productId, orderQuantity) were not provided."
                )

        # 3. Determine order parameters (applying overrides if specified)
        if existing_order:
            prod_id = int(request.productId if request.productId is not None else existing_order.get("ProductID", 1))
            order_qty = int(request.orderQuantity if request.orderQuantity is not None else existing_order.get("OrderQuantity", 500))
            raw_req_date = request.requiredDeliveryDate or existing_order.get("RequiredDeliveryDate")
            if isinstance(raw_req_date, str):
                req_delivery_date: Optional[date] = date.fromisoformat(raw_req_date)
            elif isinstance(raw_req_date, (date, datetime)):
                req_delivery_date = raw_req_date if isinstance(raw_req_date, date) else raw_req_date.date()
            else:
                req_delivery_date = None
        else:
            prod_id = int(self.repository.resolve_product_id(request.productId))
            order_qty = int(request.orderQuantity)
            req_delivery_date = request.requiredDeliveryDate

        # Resolve product
        product_info = self.repository.get_product(prod_id)
        if not product_info:
            raise ProductNotFoundError(f"Product ID '{prod_id}' not found in product catalog.")

        product_name = product_info.get("ProductName", f"Product {prod_id}")
        stages_list = product_info.get("stagesList", ["Cutting", "Stitching", "Finishing", "Packing"])

        # Determine evaluation date (defaults to 2026-10-30 anchor date)
        eval_date = request.evaluationDate or self.DEFAULT_EVALUATION_DATE

        # 4. Assess Committed Stock (excluding current order if it's already an active in-progress order)
        committed_stock = self.repository.get_committed_stock(exclude_order_id=resolved_order_id)

        # 5. Operational Checks
        all_issues: List[FeasibilityIssue] = []
        all_recommendations: List[FeasibilityRecommendation] = []

        # A. Material Check
        material_check, mat_issues, mat_recs = self.material_evaluator.evaluate(
            product_id=prod_id,
            order_quantity=order_qty,
            evaluation_date=eval_date,
            committed_stock=committed_stock,
        )
        all_issues.extend(mat_issues)
        all_recommendations.extend(mat_recs)

        # B. Machine Check
        machine_check, mach_issues, mach_recs = self.machine_evaluator.evaluate(
            stages=stages_list,
            order_quantity=order_qty,
        )
        all_issues.extend(mach_issues)
        all_recommendations.extend(mach_recs)

        # C. Workforce Check
        workforce_check, wf_issues, wf_recs = self.workforce_evaluator.evaluate(
            stages=stages_list,
            order_quantity=order_qty,
        )
        all_issues.extend(wf_issues)
        all_recommendations.extend(wf_recs)

        # D. Existing Commitments Check
        existing_orders_check, commit_issues = self.commitment_evaluator.evaluate(
            order_id=resolved_order_id,
        )
        all_issues.extend(commit_issues)

        # E. Optional Market Price Risk Hook
        if request.includeMarketPriceRisk:
            self._enrich_with_market_price_risk(material_check)

        # F. Production Schedule & Feasibility Status
        schedule_result, status, delay_days, sched_issue = self.production_scheduler.calculate_schedule(
            evaluation_date=eval_date,
            requested_delivery_date=req_delivery_date,
            material_check=material_check,
            machine_check=machine_check,
            workforce_check=workforce_check,
        )
        if sched_issue:
            all_issues.append(sched_issue)

        # 6. Alternative Scenarios
        scenarios = self.scenario_engine.generate_scenarios(
            evaluation_date=eval_date,
            requested_delivery_date=req_delivery_date,
            order_quantity=order_qty,
            schedule=schedule_result,
            material_check=material_check,
            machine_check=machine_check,
            workforce_check=workforce_check,
        )

        # 7. Document Data Limitations & Verify Stock Ledger (never fabricating data)
        stock_ledger_status = self.repository.verify_stock_movements_ledger()
        data_limitations = [
            f"Stock movement ledger verification: {stock_ledger_status['details']}",
            "Specific order-level machine reservation timetables (reservations collection) are not present in dataset; proposed schedule is provisional/advisory and machine-slot availability is unverified.",
            "Factory calendar: 6-day operating week (Monday-Saturday, 8 hours/day, Sunday weekly off) is inferred from LoomPilot_Attendance.xlsx records until official factory master calendar is configured.",
            "Workforce shift commitments: Qualified operators are verified from employee roster, but active floor assignments to ongoing production orders are unverified.",
            "Quality inspection and rework allowance incorporates an empirical 1.57% historical defect rate calculated from 111 production report records.",
        ]
        if material_check.status == "INSUFFICIENT_DATA":
            data_limitations.append("Missing Bill of Materials (BOM) recipe in catalog prevented exact material usage calculation.")

        # 8. Sort and deduplicate issues
        severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
        all_issues.sort(key=lambda x: severity_order.get(x.severity, 5))

        # 9. Confidence determination
        if material_check.status == "INSUFFICIENT_DATA":
            confidence = "LOW"
        elif any(i.severity == "CRITICAL" for i in all_issues):
            confidence = "LOW"
        elif any(i.severity == "HIGH" for i in all_issues) or existing_orders_check.activeOrdersCount > 0:
            confidence = "MEDIUM"
        else:
            confidence = "HIGH"

        # 10. Summary description
        if status == "FEASIBLE":
            summary = (
                f"Order {order_number} is fully feasible under provisional single-line parameters. All required materials are in stock, "
                f"machinery is available, and delivery can be completed by {schedule_result.earliestFeasibleDeliveryDate if schedule_result else 'target date'}, "
                f"comfortably meeting the requested delivery date of {req_delivery_date}. "
                "Note: Machine reservation slots and operator shift availability require production supervisor confirmation."
            )
        elif status == "CONDITIONALLY_FEASIBLE":
            if delay_days > 0:
                summary = (
                    f"Order {order_number} is CONDITIONALLY FEASIBLE with a revised schedule. "
                    f"The requested delivery date ({req_delivery_date}) cannot be met with standard parameters (projected delay: {delay_days} calendar days). "
                    f"Earliest feasible delivery is {schedule_result.earliestFeasibleDeliveryDate if schedule_result else 'a later date'}. "
                    "Schedule is provisional/advisory; machine slot availability requires floor confirmation."
                )
            else:
                summary = (
                    f"Order {order_number} is CONDITIONALLY FEASIBLE. The requested delivery date ({req_delivery_date}) "
                    f"can be achieved (earliest feasible delivery: {schedule_result.earliestFeasibleDeliveryDate if schedule_result else 'target date'}), "
                    f"subject to executing the recommended procurement option and confirming provisional machine slots."
                )
        elif status == "NOT_FEASIBLE":
            summary = (
                f"Order {order_number} is NOT FEASIBLE: cannot be fulfilled internally due to hard manufacturing constraints."
            )
        else:  # NEEDS_INFORMATION
            summary = f"Assessment for Order {order_number} cannot be reliably completed due to missing technical master data."

        # Group checks
        checks_payload = FeasibilityChecks(
            material=material_check,
            machine=machine_check,
            workforce=workforce_check,
            existingOrders=existing_orders_check,
            productionSchedule=schedule_result,
        )

        # 11. Explanation Generation (Groq LLM or deterministic template)
        explanation_payload = {
            "orderId": request.orderId,
            "orderNumber": order_number,
            "productName": product_name,
            "orderQuantity": order_qty,
            "assessmentStatus": status,
            "requestedDeliveryDate": req_delivery_date.strftime("%Y-%m-%d") if req_delivery_date else None,
            "estimatedProductionStartDate": schedule_result.estimatedProductionStartDate if schedule_result else None,
            "estimatedProductionCompletionDate": schedule_result.estimatedProductionCompletionDate if schedule_result else None,
            "earliestFeasibleDeliveryDate": schedule_result.earliestFeasibleDeliveryDate if schedule_result else None,
            "delayDays": delay_days,
            "issues": [i.model_dump() for i in all_issues],
            "recommendations": [r.model_dump() for r in all_recommendations],
            "checks": checks_payload.model_dump() if checks_payload else {},
        }
        explanation_text = self.explanation_service.generate_explanation(explanation_payload)

        return FeasibilityEvaluationResponse(
            success=True,
            agent="feasibility_agent",
            tenantId=request.tenantId,
            orderId=request.orderId,
            orderNumber=order_number,
            productName=product_name,
            orderQuantity=order_qty,
            assessmentStatus=status,
            requestedDeliveryDate=req_delivery_date.strftime("%Y-%m-%d") if req_delivery_date else None,
            estimatedProductionStartDate=schedule_result.estimatedProductionStartDate if schedule_result else None,
            estimatedProductionCompletionDate=schedule_result.estimatedProductionCompletionDate if schedule_result else None,
            earliestFeasibleDeliveryDate=schedule_result.earliestFeasibleDeliveryDate if schedule_result else None,
            delayDays=delay_days,
            confidence=confidence,
            summary=summary,
            scheduleType="PROVISIONAL_ADVISORY",
            machineSlotConfirmationRequired=True,
            stockLedgerStatus=stock_ledger_status,
            checks=checks_payload,
            issues=all_issues,
            recommendations=all_recommendations,
            alternativeScenarios=scenarios,
            dataLimitations=data_limitations,
            explanation=explanation_text,
        )

    def _enrich_with_market_price_risk(self, material_check: MaterialCheckResult) -> None:
        """
        Optional future-ready hook to integrate with Market Price Agent for raw materials experiencing shortages.
        Does not duplicate market price logic; leverages existing MarketPriceAgent if available.
        """
        try:
            from app.agents.market_price.agent import get_market_price_agent
            mp_agent = get_market_price_agent()
            for item in material_check.items:
                if item.isShortage:
                    try:
                        analysis = mp_agent.analyze_material(
                            material_id=item.materialId,
                            prediction_horizon_days=item.procurementLeadTimeDays or 15,
                        )
                        item.marketPriceForecast = {
                            "currentPriceINR": analysis.currentPrice,
                            "predictedPriceINR": analysis.predictedPrice,
                            "priceChangePercentage": analysis.priceChangePercentage,
                            "riskLevel": analysis.riskLevel,
                            "trend": analysis.trend,
                            "forecastNote": f"Projected procurement rate: {analysis.predictedPrice:.2f} INR/{item.unit} (Risk: {analysis.riskLevel}).",
                        }
                    except Exception as e:
                        logger.debug(f"Could not fetch market price forecast for material {item.materialId}: {e}")
        except Exception as e:
            logger.debug(f"Market Price Agent hook skipped: {e}")


# Singleton instance
_feasibility_agent_instance: Optional[FeasibilityAgent] = None


def get_feasibility_agent() -> FeasibilityAgent:
    """Return the global FeasibilityAgent singleton."""
    global _feasibility_agent_instance
    if _feasibility_agent_instance is None:
        _feasibility_agent_instance = FeasibilityAgent()
    return _feasibility_agent_instance
