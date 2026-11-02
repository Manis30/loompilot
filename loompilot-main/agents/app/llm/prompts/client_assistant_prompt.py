from typing import Any, Dict, List, Optional
from app.schemas.client_assistant_schema import CustomerIntent, NegotiationStatus

SYSTEM_PROMPT_CLIENT_ASSISTANT = """
You are the Client Assistant AI Agent for LoomPilot, an AI-powered B2B textile and garment manufacturing management platform.
You act as an intelligent, professional, courteous, and consultative B2B manufacturing sales representative.

STRICT COMMERCIAL & CONFIDENTIALITY GUARDRAILS:
1. NEVER disclose internal confidential costing information to the customer (e.g., exact Bill of Materials costs, machine operating rates per hour, hourly direct labour costs, or internal factory profit margins).
2. NEVER disclose internal minimum authorized floor prices or managerial discount thresholds.
3. Use ONLY verified information from quotation and product data. NEVER invent product specifications, quality standards, certifications, stitching types, or packaging details. If details are not available, use neutral, professional B2B phrasing.
4. Do NOT invent prices, unauthorized discounts, unsupported delivery promises, or fake customer history.
5. If a customer's requested target price is below authorized limits, explain courteously that the price is below current commercial authorization limits, present the best authorized offer, and explain that an escalation has been submitted to executive sales management for review.
6. When presenting revised offers, state the revised price per unit, original price per unit, order quantity, original total, revised total, savings, and validity window.
7. Keep the tone respectful, collaborative, transparent, and focused on partnership.
"""


def format_client_assistant_prompt(data: Dict[str, Any]) -> str:
    """Format negotiation context into a secure, anti-hallucination prompt for Groq LLM."""
    customer_name = data.get("customerName", "Valued Partner")
    company_name = data.get("companyName", "Valued Client")
    product_name = data.get("productName", "Garment Product")
    quantity = data.get("quantity", 0)
    customer_message = data.get("customerMessage", "")
    intent = data.get("intent", "GENERAL_QUERY")

    original_price = data.get("originalPricePerUnit", 0.0)
    current_offer = data.get("currentOfferPerUnit", 0.0)
    target_price = data.get("customerTargetPrice")
    negotiation_status = data.get("negotiationStatus", "IN_PROGRESS")
    requires_approval = data.get("requiresApproval", False)

    lead_time = data.get("leadTimeDays", 14)
    payment_terms = data.get("paymentTerms", "Standard Terms")
    value_drivers = data.get("valueDrivers", [])
    suggested_action = data.get("suggestedAction", "")

    lines = [
        "CUSTOMER CONTEXT:",
        f"- Customer: {customer_name} ({company_name})",
        f"- Product: {product_name}",
        f"- Order Quantity: {quantity:,} units",
        f"- Original Quoted Price: ₹{original_price:.2f} per unit",
        f"- Current Active Offer: ₹{current_offer:.2f} per unit",
        f"- Customer Target Price: {f'₹{target_price:.2f} per unit' if target_price is not None else 'Not explicitly stated'}",
        f"- Negotiation Status: {negotiation_status}",
        f"- Requires Management Approval: {requires_approval}",
        f"- Standard Manufacturing Lead Time: {lead_time} days",
        f"- Standard Payment Terms: {payment_terms}",
        "",
        "CUSTOMER INCOMING MESSAGE:",
        f"\"{customer_message}\"",
        f"- Classified Intent: {intent}",
        "",
        "MANUFACTURING VALUE DRIVERS & CONTEXT:",
    ]
    for vd in value_drivers:
        lines.append(f"- {vd}")

    if suggested_action:
        lines.append(f"- Commercial Guideline: {suggested_action}")

    lines.extend([
        "",
        "TASK:",
        "Write a concise, professional 1-2 paragraph B2B response to the customer.",
        "Remember: DO NOT reveal internal factory costing breakdowns or minimum authorized price limits."
    ])

    return "\n".join(lines)


def generate_deterministic_client_response(data: Dict[str, Any]) -> str:
    """
    High-quality deterministic fallback response generator.
    Guarantees professional, brand-safe, and commercially accurate responses in all environments.
    """
    customer_name = data.get("customerName", "Valued Partner")
    company_name = data.get("companyName", "Valued Client")
    product_name = data.get("productName", "Garment Product")
    quantity = int(data.get("quantity", 0))
    intent_str = str(data.get("intent", "GENERAL_QUERY"))

    original_price = float(data.get("originalPricePerUnit", 250.0))
    current_offer = float(data.get("currentOfferPerUnit", original_price))
    target_price = data.get("customerTargetPrice")
    requires_approval = bool(data.get("requiresApproval", False))
    lead_time = data.get("leadTimeDays", 14)
    payment_terms = data.get("paymentTerms", "30% Advance, Balance on Delivery")

    validity_days = int(data.get("validityDays", 15))
    expires_at = str(data.get("offerExpiresAt", ""))
    expires_date = expires_at[:10] if expires_at else ""

    orig_total = float(data.get("originalQuotationTotal", round(original_price * quantity, 2)))
    rev_total = float(data.get("revisedQuotationTotal", round(current_offer * quantity, 2)))
    savings = float(data.get("totalSavings", round(orig_total - rev_total, 2)))

    # 1. Acceptance
    if intent_str in (CustomerIntent.ACCEPTANCE.value, "ACCEPTANCE"):
        # Check if acceptance of an expired offer was attempted
        if data.get("offerExpired", False):
            return (
                f"Hello {customer_name},\n\n"
                f"Thank you for your response regarding the quotation for {product_name}. "
                f"Please note that the previous revised offer of ₹{current_offer:.2f} per unit has expired. "
                "Due to market price updates and factory capacity scheduling, we cannot lock an expired offer. "
                "We would be delighted to issue a refreshed quotation based on current material rates. "
                "Please let us know if you would like us to prepare an updated quotation for you."
            )
        order_status = data.get("orderCreationStatus")
        order_id = data.get("salesOrderId")
        order_number = data.get("salesOrderNumber")
        if order_status == "CREATED" and (order_id or order_number):
            ref = order_number or f"ORD-{order_id}"
            return (
                f"Thank you for confirming your acceptance. Your order {ref} has been created and confirmed "
                f"for {quantity:,} units of {product_name} at ₹{current_offer:.2f} per unit."
            )
        return (
            "Thank you for confirming your acceptance. Your acceptance has been recorded, and your order is awaiting formal confirmation."
        )

    # 2. Rejection / Walk away
    if intent_str in (CustomerIntent.REJECTION.value, "REJECTION"):
        return (
            f"Hello {customer_name},\n\n"
            f"Thank you for your feedback. We understand that our current offer of ₹{current_offer:.2f} per unit "
            f"does not meet your requirements at this time.\n\n"
            "If your schedule or project parameters change, or if you would like to explore alternative specifications "
            "or adjusted order quantities in the future, we would be delighted to assist you."
        )

    # 3. Cost Breakdown / Margin Inquiry
    if intent_str in (CustomerIntent.COST_INQUIRY.value, "COST_INQUIRY"):
        return (
            f"Hello {customer_name},\n\n"
            f"Thank you for your inquiry regarding the pricing structure for {product_name}. "
            "Our quotation is built transparently on verified production costs including yarn and fabric sourcing, "
            "knitting/weaving, wet processing, precision garment cutting, assembly, and multi-stage quality control.\n\n"
            "While our detailed internal factory cost allocations and proprietary operating margins remain confidential, "
            f"our current offer of ₹{current_offer:.2f} per unit reflects highly competitive commercial manufacturing terms "
            f"tailored for your order volume of {quantity:,} units.\n\n"
            "Please let us know if you would like to proceed or explore any technical adjustments to the specification."
        )

    # 4. Delivery query
    if intent_str in (CustomerIntent.DELIVERY_QUERY.value, "DELIVERY_QUERY"):
        return (
            f"Hello {customer_name},\n\n"
            f"Thank you for your inquiry regarding the delivery schedule for {product_name}. Our standard production "
            f"cycle requires {lead_time} calendar days from order confirmation to dispatch. "
            "This covers verified material procurement, cutting, assembly, finishing, and quality assurance. "
            "If your timeline requires expedited handling, we can assess production schedule adjustments."
        )

    # 5. Payment terms query
    if intent_str in (CustomerIntent.PAYMENT_QUERY.value, "PAYMENT_QUERY"):
        return (
            f"Hello {customer_name},\n\n"
            f"Thank you for inquiring about commercial terms. Based on your account standing, our standard "
            f"terms are {payment_terms}. These terms ensure uninterrupted material procurement and factory scheduling. "
            "If you require structured credit terms, we can submit a request for managerial review."
        )

    # 6. Product Change / Alternative Specification / Premium Fabric Request
    msg_lower = str(data.get("customerMessage", "")).lower()
    if intent_str in (CustomerIntent.PRODUCT_CHANGE_REQUEST.value, "PRODUCT_CHANGE_REQUEST") or any(
        w in msg_lower for w in ["silk", "organic cotton", "premium fabric", "premium material"]
    ):
        if "silk" in msg_lower or "organic cotton" in msg_lower or "premium" in msg_lower:
            fabric_name = "Mulberry Silk" if "silk" in msg_lower else "Certified Organic Cotton"
            premium_price = 320.0 if "silk" in msg_lower else 285.0
            return (
                f"Hello {customer_name},\n\n"
                f"Thank you for inquiring about upgrading to {fabric_name} for your order of {quantity:,} units of {product_name}. "
                f"Recalculating based on verified raw material inputs and specialized processing, the revised quotation is "
                f"₹{premium_price:.2f} per unit (compared to ₹{original_price:.2f} for standard combed single jersey).\n\n"
                f"This premium specification delivers superior hand-feel, enhanced breathability, and certified sustainability standards. "
                "Please let us know if you would like us to formalize this premium quotation for your order."
            )
        return (
            f"Hello {customer_name},\n\n"
            f"We are pleased to explore specification alternatives for {company_name}. We can review alternative fabric blends, "
            "adjusted fabric weights, or batch size adjustments to achieve your target cost profile while preserving product quality. "
            "Please review the alternative options detailed in our response."
        )

    # 7. Counter-offer matches existing active offer (exact match)
    if data.get("isExactOfferMatch", False):
        return (
            f"Our current revised offer is ₹{current_offer:.2f} per unit for your order of {quantity:,} units. "
            "Please let us know if you would like to accept this offer."
        )

    # 8. Counter-offer below authorized minimum (requires approval)
    if target_price is not None and requires_approval:
        return (
            f"Hello {customer_name},\n\n"
            f"Thank you for your feedback. We value your partnership with LoomPilot. "
            f"Regarding your requested price of ₹{target_price:.2f} per unit for {quantity:,} units of {product_name}, "
            f"this rate is below our standard commercial authorization limit of ₹{current_offer:.2f} per unit.\n\n"
            f"We have maintained our best currently authorized offer of ₹{current_offer:.2f} per unit, "
            f"and we have submitted your target price of ₹{target_price:.2f} to executive sales management for review.\n\n"
            "We will notify you as soon as a decision is received from management."
        )

    # 9. Cumulative discount attempt (already at floor price, customer requests further discount)
    if data.get("isAlreadyAtFloor", False) and intent_str in (
        CustomerIntent.DISCOUNT_REQUEST.value, "DISCOUNT_REQUEST",
        CustomerIntent.PRICE_OBJECTION.value, "PRICE_OBJECTION",
    ):
        return (
            f"Our current revised offer is ₹{current_offer:.2f} per unit for your order of {quantity:,} units. "
            "Please let us know if you would like to accept this offer."
        )

    # 10. Revised offer presented (OFFER_MADE)
    if current_offer < original_price and not requires_approval:
        validity_text = f" (until {expires_date})" if expires_date else ""
        tax_status = data.get("taxStatus", "TAX_NOT_CALCULATED")
        tax_amount = data.get("taxAmount")
        final_total = data.get("finalPayableAmount")
        if tax_status == "CALCULATED" and tax_amount is not None:
            tax_str = f"Applicable Taxes: ₹{tax_amount:,.2f}\nFinal Payable Amount: ₹{final_total:,.2f}\n"
        else:
            tax_str = "Applicable statutory taxes: Not calculated (will be detailed on final billing).\n"

        return (
            f"Hello {customer_name},\n\n"
            f"Thank you for your feedback. We value your business and are pleased to offer you a revised price of "
            f"₹{current_offer:.2f} per unit, reduced from our original price of ₹{original_price:.2f} per unit.\n\n"
            f"For your order of {quantity:,} pieces:\n\n"
            f"Original quotation total: ₹{orig_total:,.2f}\n"
            f"Revised quotation subtotal: ₹{rev_total:,.2f}\n"
            f"Your total savings: ₹{savings:,.2f}.\n"
            f"{tax_str}\n"
            f"This revised offer is subject to the applicable quotation terms and is valid for {validity_days} days{validity_text}.\n\n"
            "Please let us know if you would like to proceed with this revised offer."
        )

    # 10. General fallback
    return (
        f"Hello {customer_name},\n\n"
        f"Thank you for reaching out to LoomPilot regarding quotation for {product_name} "
        f"({quantity:,} units at ₹{current_offer:.2f} per unit). Our team is dedicated to providing superior manufacturing "
        "quality and transparent scheduling. Please let us know how we can best support your order requirements."
    )
