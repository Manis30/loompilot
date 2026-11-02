from typing import Any, Dict, List, Optional

from app.core.logging import get_logger
from app.llm.groq_client import GroqClient, get_groq_client
from app.llm.prompts.feasibility_prompt import (
    SYSTEM_PROMPT_FEASIBILITY_EXPLANATION,
    format_feasibility_prompt,
)

logger = get_logger(__name__)


class FeasibilityExplanationService:
    """
    Translates technical manufacturing and scheduling data into clear, actionable,
    business-level explanations for plant managers and factory administrators.
    Employs Groq LLM when configured, with high-fidelity deterministic fallback templates.
    """

    def __init__(self, groq_client: Optional[GroqClient] = None):
        self.groq_client = groq_client or get_groq_client()

    def generate_explanation(self, data: Dict[str, Any]) -> str:
        """
        Generate comprehensive natural-language explanation.
        Uses Groq if available; falls back to deterministic rule-based template.
        """
        if self.groq_client.is_configured:
            try:
                prompt = format_feasibility_prompt(data)
                completion = self.groq_client.generate_completion(
                    system_prompt=SYSTEM_PROMPT_FEASIBILITY_EXPLANATION,
                    user_prompt=prompt,
                    temperature=0.2,
                    max_tokens=500,
                )
                if completion:
                    return completion.strip()
            except Exception as e:
                logger.warning(f"Groq explanation generation failed, using fallback: {e}")

        return self._generate_fallback_explanation(data)

    def _generate_fallback_explanation(self, data: Dict[str, Any]) -> str:
        """Generate high-fidelity template explanation grounded strictly in calculated metrics."""
        order_number = data.get("orderNumber", data.get("orderId", "Order"))
        product_name = data.get("productName", "Garment")
        order_quantity = data.get("orderQuantity", 0)
        status = data.get("assessmentStatus", "CONDITIONALLY_FEASIBLE")
        req_date = data.get("requestedDeliveryDate")
        start_date = data.get("estimatedProductionStartDate")
        comp_date = data.get("estimatedProductionCompletionDate")
        feas_date = data.get("earliestFeasibleDeliveryDate")
        delay_days = data.get("delayDays", 0)

        issues = data.get("issues", [])
        recommendations = data.get("recommendations", [])
        checks = data.get("checks", {})

        paragraphs: List[str] = []

        # 1. Executive Verdict
        if status == "FEASIBLE":
            paragraphs.append(
                f"Order {order_number} for {order_quantity:,} units of {product_name} is FULLY FEASIBLE. "
                f"All required raw materials are available in unallocated warehouse stock, machinery across all "
                f"stages is operational, and production can be completed comfortably before the requested delivery date of {req_date}."
            )
        elif status == "CONDITIONALLY_FEASIBLE":
            if delay_days > 0:
                paragraphs.append(
                    f"Order {order_number} for {order_quantity:,} units of {product_name} is CONDITIONALLY FEASIBLE with a revised schedule. "
                    f"The requested delivery date of {req_date} cannot be achieved under standard single-line parameters (projected delay of {delay_days} calendar days). "
                    f"The earliest realistic date the finished goods can be delivered to the client is {feas_date}."
                )
            else:
                paragraphs.append(
                    f"Order {order_number} for {order_quantity:,} units of {product_name} is CONDITIONALLY FEASIBLE. "
                    f"The requested delivery date ({req_date}) CAN BE ACHIEVED (earliest feasible delivery: {feas_date}), "
                    f"subject to immediate confirmation and execution of required material replenishment and prerequisite operational actions."
                )
        elif status == "NOT_FEASIBLE":
            paragraphs.append(
                f"Order {order_number} for {order_quantity:,} units of {product_name} is NOT FEASIBLE under current operational conditions. "
                "Hard manufacturing constraints (such as missing production infrastructure or unattainable delivery windows) "
                "prevent internal manufacturing without major structural intervention."
            )
        else:  # NEEDS_INFORMATION
            paragraphs.append(
                f"Assessment for Order {order_number} ({product_name}) CANNOT BE COMPLETED due to missing master data. "
                "Essential technical specifications, such as the standard Bill of Materials (BOM) or machine configurations, "
                "must be registered in the catalog before feasibility can be computed."
            )
            return paragraphs[0]

        # 2. Key Operational Constraints (What is wrong? Why? Which resource?)
        if issues:
            constraint_descs = []
            for issue in issues:
                cat = issue.get("category", "")
                res = issue.get("resourceName", "Resource")
                expl = issue.get("explanation", "")
                impact = issue.get("businessImpact", "")
                constraint_descs.append(f"• {res}: {expl} Business Impact: {impact}")

            paragraphs.append("Operational Findings & Constraints:\n" + "\n".join(constraint_descs))

        # 3. Schedule Breakdown
        if feas_date and start_date and comp_date:
            cycle_days = checks.get("productionSchedule", {}).get("totalCycleDays", 0)
            paragraphs.append(
                f"Production Timeline & Milestone Sequence:\n"
                f"• Estimated Production Start: {start_date}\n"
                f"• Estimated Production Completion: {comp_date}\n"
                f"• Earliest Feasible Delivery: {feas_date} (Total cycle: {cycle_days} calendar days)\n"
                f"• Delivery Variance: {'On schedule' if delay_days == 0 else f'{delay_days} day(s) late against requested date {req_date}'}"
            )

        # 4. Actionable Management Next Steps
        if recommendations:
            rec_texts = [f"• [{r.get('priority', 'ACTION')}] {r.get('action')}" for r in recommendations]
            paragraphs.append("Recommended Management Actions:\n" + "\n".join(rec_texts))

        return "\n\n".join(paragraphs)

