from typing import Any, Dict, Optional
from app.schemas.supplier_assistant_schema import (
    SupplierNegotiationIntent,
    SupplierNegotiationStatus,
)

SYSTEM_PROMPT_SUPPLIER_ASSISTANT = """
You are the Material Supplier Assistant AI Agent for LoomPilot, representing LoomPilot in commercial raw material procurement negotiations with external suppliers.

STRICT PROCUREMENT & CONFIDENTIALITY GUARDRAILS:
1. NEVER disclose LoomPilot's customer sales prices, factory profit margins, production budget ceilings, or internal maximum willingness to pay to suppliers.
2. NEVER reveal internal approval limits or say "my maximum authorized price is X".
3. Use ONLY verified market price benchmarks and catalog historical data. Do NOT fabricate fake price trends or inventory stats.
4. Maintain a firm, professional, courteous, and collaborative B2B commercial tone.
5. Counter-offer based on market data, order volume, prompt payment terms, and inventory leverage.
6. If a supplier quote exceeds authorization limits, escalate to executive procurement management.
"""


def format_supplier_assistant_prompt(data: Dict[str, Any]) -> str:
    """Format procurement context for Groq LLM."""
    supplier_name = data.get("supplierName", "Valued Supplier")
    material_name = data.get("materialName", "Raw Material")
    quantity = data.get("quantity", 0)
    unit = data.get("unit", "units")
    supplier_message = data.get("supplierMessage", "")
    intent = data.get("intent", "GENERAL_QUERY")

    quoted_price = data.get("supplierQuotedPrice")
    counter_price = data.get("loompilotCounterPrice")
    recorded_price = data.get("recordedUnitPrice", 0.0)
    market_price = data.get("marketSpotPrice", 0.0)

    lines = [
        "PROCUREMENT CONTEXT:",
        f"- Supplier: {supplier_name}",
        f"- Material: {material_name}",
        f"- Order Batch: {quantity:,} {unit}",
        f"- Supplier Quoted Price: ₹{quoted_price:.2f}/{unit}" if quoted_price else "- No explicit quote in turn",
        f"- LoomPilot Counter Price: ₹{counter_price:.2f}/{unit}" if counter_price else "- Counter not formulated",
        f"- Historical Recorded Purchase Price: ₹{recorded_price:.2f}/{unit}",
        f"- Verified Market Benchmark: ₹{market_price:.2f}/{unit}",
        "",
        "SUPPLIER MESSAGE:",
        f"\"{supplier_message}\"",
        f"- Classified Intent: {intent}",
        "",
        "TASK:",
        "Write a concise, professional 1-2 paragraph B2B procurement response.",
        "Remember: DO NOT reveal internal factory profit margins, maximum willingness to pay, or customer prices."
    ]

    return "\n".join(lines)


def generate_deterministic_supplier_response(data: Dict[str, Any]) -> str:
    """
    Deterministic procurement response generator.
    Guarantees commercially disciplined, factual, and professional responses.
    """
    supplier_name = data.get("supplierName", "Valued Supplier")
    material_name = data.get("materialName", "Raw Material")
    quantity = float(data.get("quantity", 0))
    unit = str(data.get("unit", "kg"))
    intent = str(data.get("intent", "GENERAL_QUERY"))
    status = str(data.get("negotiationStatus", "IN_PROGRESS"))

    quoted_price = data.get("supplierQuotedPrice")
    counter_price = data.get("loompilotCounterPrice")
    recorded_price = float(data.get("recordedUnitPrice", 185.0))
    market_price = float(data.get("marketSpotPrice", 190.0))
    requires_approval = bool(data.get("requiresApproval", False))

    # 1. Supplier Acceptance
    if intent in (SupplierNegotiationIntent.ACCEPTANCE.value, "ACCEPTANCE"):
        agreed_price = counter_price or quoted_price or recorded_price
        return (
            f"Dear {supplier_name},\n\n"
            f"Thank you for confirming acceptance of our procurement terms for {quantity:,.0f} {unit} of {material_name} "
            f"at ₹{agreed_price:.2f}/{unit}. We have formally locked this agreement in our procurement schedule.\n\n"
            "Please dispatch the formal Proforma Invoice and share the scheduled batch dispatch dates at your earliest convenience."
        )

    # 2. Supplier Rejection / Walk away
    if intent in (SupplierNegotiationIntent.REJECTION.value, "REJECTION"):
        return (
            f"Dear {supplier_name},\n\n"
            f"We acknowledge your position regarding the pricing for {material_name}. While we understand your current constraints, "
            f"our offered rate of ₹{counter_price or recorded_price:.2f}/{unit} is strictly aligned with prevailing market indices.\n\n"
            "Should your inventory or pricing flexibility change for upcoming procurement cycles, we welcome the opportunity to re-engage."
        )

    # 3. Quality Variation (Scenario 6: Lower GSM / Lower Grade)
    if intent in (SupplierNegotiationIntent.QUALITY_VARIATION.value, "QUALITY_VARIATION"):
        proposed_gsm = data.get("proposedGsm", 160)
        required_gsm = data.get("requiredGsm", 180)
        return (
            f"Dear {supplier_name},\n\n"
            f"Thank you for presenting the alternative lot specification. However, LoomPilot's manufacturing BOM mandates a "
            f"minimum fabric weight of {required_gsm:.0f} GSM for our active production contracts. A {proposed_gsm:.0f} GSM fabric "
            "fails our tensile durability and fabric density quality standards.\n\n"
            f"We kindly request you to maintain the verified {required_gsm:.0f} GSM combed cotton specification for this order."
        )

    # 4. Bulk Discount Offer (Scenario 2: e.g. ₹180/kg for 2,000 kg vs ₹185 for 500 kg)
    if intent in (SupplierNegotiationIntent.BULK_DISCOUNT_OFFER.value, "BULK_DISCOUNT_OFFER"):
        bulk_price = data.get("bulkPrice", quoted_price or 180.0)
        bulk_qty = data.get("bulkQuantity", quantity or 2000.0)
        base_price = data.get("basePrice", recorded_price or 185.0)
        return (
            f"Dear {supplier_name},\n\n"
            f"Thank you for providing tiered volume pricing for {material_name}. We have reviewed our upcoming manufacturing pipeline "
            f"and warehouse capacity. We are pleased to accept the volume commitment of {bulk_qty:,.0f} {unit} at ₹{bulk_price:.2f}/{unit} "
            f"(saving ₹{abs(base_price - bulk_price):.2f}/{unit} against standard lot pricing).\n\n"
            "Please forward the purchase order confirmation and delivery schedule for the expanded batch."
        )

    # 5. Price Increase / Shortage Claim (Scenario 3: Shortage claim check)
    if intent in (SupplierNegotiationIntent.PRICE_INCREASE.value, "PRICE_INCREASE"):
        shortage_verified = data.get("shortageVerified", False)
        if not shortage_verified:
            return (
                f"Dear {supplier_name},\n\n"
                f"Thank you for your update. We have cross-referenced your notification of market supply shortages with our independent "
                f"LoomPilot textile price tracking feeds. Current spot market observations for {material_name} remain stable at "
                f"approximately ₹{market_price:.2f}/{unit} with adequate market liquidity.\n\n"
                f"Given our steady procurement relationship, we cannot absorb an uncorroborated increase to ₹{quoted_price:.2f}/{unit}. "
                f"We propose locking this batch at ₹{counter_price or market_price:.2f}/{unit} based on verified market indices."
            )
        else:
            return (
                f"Dear {supplier_name},\n\n"
                f"We have noted the temporary market tightening for {material_name}. To mitigate mutual supply chain risk while keeping production "
                f"viable, we can adjust our intake price to ₹{counter_price or market_price:.2f}/{unit}. Please let us know if we can proceed."
            )

    # 6. Payment Terms Negotiation (Scenario 4: 2% cash discount for 15-day payment vs Net 30)
    if intent in (SupplierNegotiationIntent.PAYMENT_TERM_DISCOUNT.value, "PAYMENT_TERM_DISCOUNT"):
        disc_pct = data.get("cashDiscountPct", 2.0)
        early_days = data.get("earlyPaymentDays", 15)
        concession_price = data.get("negotiatedPrice", round(recorded_price * 0.98, 2))
        return (
            f"Dear {supplier_name},\n\n"
            f"Regarding commercial payment terms for {material_name}: In lieu of standard Net 30 settlement, LoomPilot is prepared to offer "
            f"accelerated settlement within {early_days} days of verified receipt in exchange for a {disc_pct:.0f}% prompt payment cash discount, "
            f"bringing the effective net rate to ₹{concession_price:.2f}/{unit}.\n\n"
            f"This provides immediate liquidity for your operations while optimizing our raw material procurement budget. Please confirm if this structure works for your team."
        )

    # 7. Escalation / Ceiling Breach (Scenario 5: Exceeds maximum authorized limit)
    if requires_approval or status in (SupplierNegotiationStatus.PENDING_APPROVAL.value, "PENDING_APPROVAL"):
        return (
            f"Dear {supplier_name},\n\n"
            f"Thank you for your quotation of ₹{quoted_price:.2f}/{unit} for {quantity:,.0f} {unit} of {material_name}. "
            f"This rate is significantly above our standard market benchmark of ₹{market_price:.2f}/{unit} and historical rate of ₹{recorded_price:.2f}/{unit}.\n\n"
            f"Our best currently counter-offer stands at ₹{counter_price or market_price:.2f}/{unit}. We have submitted your requested price "
            "to executive procurement management for review, as it exceeds our standard commercial procurement guidelines. "
            "We will revert with management's decision promptly."
        )

    # 8. Standard Counter-Offer (Scenario 1: Quoted ₹210 vs Historical ₹185, Market ₹190 -> Counter ₹188-192)
    if counter_price and quoted_price and quoted_price > counter_price:
        return (
            f"Dear {supplier_name},\n\n"
            f"Thank you for submitting your quotation of ₹{quoted_price:.2f}/{unit} for {quantity:,.0f} {unit} of {material_name}. "
            f"Based on our recent recorded purchase rate of ₹{recorded_price:.2f}/{unit} and verified spot market benchmarks at ₹{market_price:.2f}/{unit}, "
            f"we counter-offer at ₹{counter_price:.2f}/{unit}.\n\n"
            "This reflects realistic market conditions while ensuring prompt settlement and consistent order volume. We look forward to your confirmation."
        )

    # 9. General Fallback
    return (
        f"Dear {supplier_name},\n\n"
        f"Thank you for contacting LoomPilot Procurement regarding {material_name}. Our current benchmark rate is ₹{market_price:.2f}/{unit} "
        f"based on recent procurement cycles. Please let us know your available delivery dates and lot test reports so we can proceed."
    )

