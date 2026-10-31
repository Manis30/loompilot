from typing import Any, Dict, List

SYSTEM_PROMPT_FEASIBILITY_EXPLANATION = """
You are the Feasibility AI Agent for LoomPilot, an enterprise textile and garment manufacturing management system.
Your job is to provide clear, empathetic, practical, and executive-level business reasoning to a factory owner or plant administrator regarding whether a manufacturing order can be fulfilled within the requested deadline.

STRICT FACTUAL GUARDRAILS:
1. Speak in plain business and manufacturing language, avoiding dry technical jargon.
2. Ground all statements strictly in the provided calculation numbers (quantities, dates, capacities, shortages, lead times).
3. Clearly answer: What is wrong? Why is it happening? Which material, machine, process, or workforce is affected? How does it affect the delivery date? What can be done to solve it?
4. Never promise or invent changes to orders, stock balances, or schedules—your role is strictly advisory.
5. Explicitly state if administrative or client approval is needed.
6. Keep the final response well-structured with clear paragraphs or executive bullet points.
"""


def format_feasibility_prompt(data: Dict[str, Any]) -> str:
    """Format structured manufacturing assessment data into an anti-hallucination prompt."""
    order_id = data.get("orderId")
    order_number = data.get("orderNumber", order_id)
    product_name = data.get("productName", "Garment")
    order_quantity = data.get("orderQuantity", 0)
    status = data.get("assessmentStatus", "CONDITIONALLY_FEASIBLE")
    req_date = data.get("requestedDeliveryDate", "Not specified")
    start_date = data.get("estimatedProductionStartDate", "Pending")
    comp_date = data.get("estimatedProductionCompletionDate", "Pending")
    feas_date = data.get("earliestFeasibleDeliveryDate", "Pending")
    delay_days = data.get("delayDays", 0)

    issues = data.get("issues", [])
    recommendations = data.get("recommendations", [])
    checks = data.get("checks", {})

    lines = [
        f"ASSESSMENT CONTEXT:",
        f"- Order: {order_number} (ID: {order_id})",
        f"- Product: {product_name}",
        f"- Order Quantity: {order_quantity:,} units",
        f"- Overall Status: {status}",
        f"- Requested Delivery Date: {req_date}",
        f"- Estimated Production Start Date: {start_date}",
        f"- Estimated Production Completion Date: {comp_date}",
        f"- Earliest Feasible Delivery Date: {feas_date}",
        f"- Schedule Delay: {delay_days} day(s)",
        "",
        "OPERATIONAL CHECKS SUMMARY:",
        f"- Material Check: {checks.get('material', {}).get('summary', 'N/A')}",
        f"- Machine Check: {checks.get('machine', {}).get('summary', 'N/A')}",
        f"- Workforce Check: {checks.get('workforce', {}).get('summary', 'N/A')}",
        f"- Backlog Check: {checks.get('existingOrders', {}).get('summary', 'N/A')}",
        "",
        f"KEY ISSUES IDENTIFIED ({len(issues)}):",
    ]

    for i, issue in enumerate(issues[:5], 1):
        lines.append(
            f"  {i}. [{issue.get('category')}] {issue.get('title')}: {issue.get('explanation')} "
            f"(Impact: {issue.get('businessImpact')}) -> Recommendation: {issue.get('recommendation')}"
        )

    lines.append("")
    lines.append(f"RECOMMENDED ACTIONS ({len(recommendations)}):")
    for j, rec in enumerate(recommendations[:5], 1):
        lines.append(f"  {j}. [{rec.get('priority')}] {rec.get('action')} (Impact: {rec.get('expectedImpact')})")

    lines.append("")
    lines.append(
        "Generate a complete, executive-grade business assessment summary explaining: "
        "1) The primary feasibility conclusion, 2) The exact operational bottlenecks causing any delay, "
        "3) The earliest realistic date the client can receive their goods, and 4) Clear management recommendations."
    )

    return "\n".join(lines)

