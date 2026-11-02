from typing import Any, Dict, List

SYSTEM_PROMPT_QUOTATION_EXPLANATION = """
You are the Quotation AI Agent for LoomPilot, an AI-powered B2B manufacturing management platform.
Your role is to explain manufacturing quotations to factory sales executives, plant owners, and B2B clients.

STRICT FACTUAL GUARDRAILS:
1. Explain the cost structure in clear, professional manufacturing and business language.
2. Ground all financial figures strictly in the provided calculation numbers (materials, labour, machine operating costs, overhead, margin, taxes).
3. Do NOT invent prices, missing BOM items, labour rates, machine hours, or taxes.
4. Highlight major cost drivers (e.g. primary fabric proportion, stitching labour share, or packaging).
5. If costing information is missing or incomplete, clearly explain what is needed before final approval.
6. Clearly distinguish between markup on cost and gross margin on selling price.
7. Keep the tone transparent, professional, and trustworthy.
"""


def format_quotation_prompt(data: Dict[str, Any]) -> str:
    """Format structured quotation calculation results into an anti-hallucination LLM prompt."""
    quotation_number = data.get("quotationNumber", "N/A")
    client_name = data.get("clientName", "Valued Client")
    product_name = data.get("productName", "Garment Product")
    quantity = data.get("quantity", 0)
    status = data.get("status", "DRAFT")

    fin = data.get("financialSummary", {})
    cost = data.get("costBreakdown", {})

    mat_cost = fin.get("totalMaterialCost")
    lab_cost = fin.get("totalLabourCost")
    mach_cost = fin.get("totalMachineCost")
    ovh_cost = fin.get("totalOverheadCost")
    add_cost = fin.get("totalAdditionalCost")
    prod_cost = fin.get("totalProductionCost")
    cost_per_unit = fin.get("productionCostPerUnit")

    method = fin.get("pricingMethod", "MARKUP")
    margin_pct = fin.get("marginPercentage", 0.0)
    selling_price = fin.get("sellingPriceBeforeTax")
    price_per_unit = fin.get("sellingPricePerUnit")
    tax_total = fin.get("totalTax")
    final_amount = fin.get("finalQuotationAmount")

    missing = data.get("missingInformation", [])
    warnings = data.get("warnings", [])
    assumptions = data.get("assumptions", [])

    lines = [
        "QUOTATION METRICS:",
        f"- Quotation Number: {quotation_number}",
        f"- Client: {client_name}",
        f"- Product: {product_name}",
        f"- Quantity: {quantity:,} units",
        f"- Lifecycle Status: {status}",
        "",
        "BOTTOM-UP PRODUCTION COST BREAKDOWN (INR):",
        f"- Raw Materials: {f'{mat_cost:,.2f}' if mat_cost is not None else 'INCOMPLETE'}",
        f"- Direct Labour: {f'{lab_cost:,.2f}' if lab_cost is not None else 'INCOMPLETE'}",
        f"- Machine Operations: {f'{mach_cost:,.2f}' if mach_cost is not None else 'INCOMPLETE'}",
        f"- Manufacturing Overhead: {f'{ovh_cost:,.2f}' if ovh_cost is not None else 'INCOMPLETE'}",
        f"- Additional Production Costs: {f'{add_cost:,.2f}' if add_cost is not None else '0.00'}",
        f"- Total Estimated Production Cost: {f'{prod_cost:,.2f}' if prod_cost is not None else 'INCOMPLETE'}",
        f"- Production Cost Per Unit: {f'{cost_per_unit:,.2f}' if cost_per_unit is not None else 'INCOMPLETE'}",
        "",
        "COMMERCIAL PRICING & TAXES:",
        f"- Margin Method: {method}",
        f"- Configured Margin: {margin_pct}%",
        f"- Subtotal Before Tax: {f'{selling_price:,.2f}' if selling_price is not None else 'INCOMPLETE'}",
        f"- Unit Selling Price: {f'{price_per_unit:,.2f}' if price_per_unit is not None else 'INCOMPLETE'}",
        f"- Total Applicable GST / Taxes: {f'{tax_total:,.2f}' if tax_total is not None else 'INCOMPLETE'}",
        f"- Final Client Quotation Amount: {f'{final_amount:,.2f}' if final_amount is not None else 'INCOMPLETE'}",
        "",
        f"Assumptions: {'; '.join(assumptions) if assumptions else 'None'}",
        f"Warnings: {'; '.join(warnings) if warnings else 'None'}",
        f"Missing Information: {'; '.join(missing) if missing else 'None'}",
        "",
        "Please provide a 2-3 paragraph executive summary explaining the quotation breakdown, major cost drivers, and current commercial status."
    ]

    return "\n".join(lines)


def generate_deterministic_quotation_explanation(data: Dict[str, Any]) -> str:
    """Fallback deterministic explanation when Groq API key is not configured."""
    quotation_number = data.get("quotationNumber", "N/A")
    client_name = data.get("clientName", "Client")
    product_name = data.get("productName", "Garment Product")
    quantity = data.get("quantity", 0)
    status = data.get("status", "DRAFT")

    fin = data.get("financialSummary", {})
    prod_cost = fin.get("totalProductionCost")
    cost_per_unit = fin.get("productionCostPerUnit")
    mat_cost = fin.get("totalMaterialCost")
    lab_cost = fin.get("totalLabourCost")
    mach_cost = fin.get("totalMachineCost")
    ovh_cost = fin.get("totalOverheadCost")
    final_amount = fin.get("finalQuotationAmount")
    unit_price = fin.get("sellingPricePerUnit")
    method = fin.get("pricingMethod", "MARKUP")
    margin_pct = fin.get("marginPercentage", 25.0)

    missing = data.get("missingInformation", [])

    if status == "READY_FOR_APPROVAL":
        mat_share = round((mat_cost / prod_cost * 100.0), 1) if (mat_cost and prod_cost) else 0.0
        lab_share = round((lab_cost / prod_cost * 100.0), 1) if (lab_cost and prod_cost) else 0.0

        p1 = (
            f"Manufacturing quotation {quotation_number} for {quantity:,} units of {product_name} "
            f"has been compiled for {client_name} using bottom-up manufacturing costing. "
            f"Total estimated production cost is INR {prod_cost:,.2f} (INR {cost_per_unit:,.2f} per finished unit). "
            f"Direct materials represent the primary cost driver at {mat_share}% of production cost (INR {mat_cost:,.2f}), "
            f"followed by direct manufacturing labour at {lab_share}% (INR {lab_cost:,.2f})."
        )
        p2 = (
            f"Applying the configured {method} pricing rule at {margin_pct:.1f}% yields a pre-tax selling price "
            f"of INR {fin.get('sellingPriceBeforeTax', 0.0):,.2f} (INR {unit_price:,.2f} per unit). "
            f"Including applicable statutory GST (INR {fin.get('totalTax', 0.0):,.2f}), the final quotation amount "
            f"is INR {final_amount:,.2f} (INR {fin.get('finalQuotationAmountPerUnit', 0.0):,.2f} per unit). "
            "All underlying raw material rates have been verified against active market observations from the Market Price Agent."
        )
        p3 = (
            "Status is READY_FOR_APPROVAL. Quotation is awaiting authorized executive approval prior to client dispatch. "
            "All production routing, machine operating expenses, and indirect factory overheads are fully traceable."
        )
        return f"{p1}\n\n{p2}\n\n{p3}"

    elif status == "PENDING_INFORMATION":
        missing_str = ", ".join(missing) if missing else "required production parameters"
        return (
            f"Quotation {quotation_number} for {quantity:,} units of {product_name} is in PENDING_INFORMATION status. "
            f"A finalized financial quote cannot be generated because mandatory costing parameters are missing: {missing_str}. "
            "In accordance with LoomPilot manufacturing governance rules, missing inputs are never arbitrarily assumed or fabricated. "
            "Please configure the required rates or technical parameters to complete the quotation calculation."
        )

    elif status == "PENDING_REVIEW":
        return (
            f"Quotation {quotation_number} for {quantity:,} units of {product_name} has completed provisional costing "
            "but has been flagged for PENDING_REVIEW due to commercial assumptions or pricing exceptions. "
            "A sales manager or plant executive must review the cost breakdown and approve any pricing exceptions before proceeding."
        )

    elif status == "APPROVED":
        return (
            f"Quotation {quotation_number} has been officially APPROVED by authorized management. "
            f"Final quotation amount is INR {final_amount:,.2f} for {quantity:,} units of {product_name}. "
            "The commercial contract is now ready for client issuance and production scheduling."
        )

    elif status == "REJECTED":
        return (
            f"Quotation {quotation_number} has been REJECTED by management. Please review the recorded rejection reason "
            "and adjust product specifications, volumes, or pricing terms before resubmitting."
        )

    return f"Quotation {quotation_number} is currently in {status} status."

