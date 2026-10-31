from typing import Any, Dict, Optional

from app.schemas.client_assistant_schema import CustomerIntent, CustomerProfile
from app.schemas.quotation_schema import QuotationDetail


class ObjectionHandler:
    """
    Structured domain objection handler for B2B manufacturing sales.
    Provides consultative, value-focused responses to commercial objections
    without exposing internal costing secrets or unauthorized pricing.
    """

    def generate_objection_context(
        self,
        quotation: QuotationDetail,
        customer_profile: CustomerProfile,
        intent: CustomerIntent,
        customer_message: str,
        current_offer: float,
        minimum_authorized: float,
        target_price: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Produce structured contextual arguments for resolving the specific objection.
        """
        product_name = quotation.productName
        quantity = quotation.quantity
        stages = quotation.product.stages
        msg_lower = customer_message.lower()

        fin = quotation.financialSummary
        original_price = float(fin.sellingPricePerUnit or (fin.finalQuotationAmount / max(1, quantity)))

        objection_type = "GENERAL"
        value_drivers = []
        proposed_action = ""

        # 1. Price is too expensive
        if intent == CustomerIntent.PRICE_OBJECTION or "expensive" in msg_lower or "too high" in msg_lower:
            objection_type = "PRICE_TOO_HIGH"
            fabric_name = getattr(quotation.product, "fabric", None) or "Specified fabric"
            value_drivers = [
                f"Verified material specification using {fabric_name} for {product_name}.",
                f"Quality assurance across verified production stages ({', '.join(stages)}).",
                f"Dedicated manufacturing allocation for order volume of {quantity:,} units.",
            ]
            proposed_action = (
                f"Our quoted rate of ₹{original_price:.2f} per unit reflects complete production specifications. "
                "We can review volume scaling or slight specification adjustments if you need to hit a tighter budget."
            )

        # 2. Competitor offering lower price
        elif "another supplier" in msg_lower or "competitor" in msg_lower or "other vendor" in msg_lower:
            objection_type = "COMPETITOR_COMPARISON"
            value_drivers = [
                "LoomPilot's production lines operate on committed manufacturing schedules with dedicated line capacity.",
                "Direct mill-backed material traceability with verified yarn count and GSM.",
                "Standard quality inspection provided with every production run.",
            ]
            proposed_action = (
                "Competitor quotations often use different fabric specifications, altered tolerances, or exclude finishing charges. "
                "We are happy to review their detailed technical specs to compare specifications objectively."
            )

        # 3. Delivery lead time query or objection
        elif intent == CustomerIntent.DELIVERY_QUERY or "delivery" in msg_lower or "lead time" in msg_lower or "rush" in msg_lower:
            objection_type = "DELIVERY_TIMELINE"
            lead_days = quotation.estimatedLeadTimeDays or 14
            value_drivers = [
                f"Standard production schedule requires {lead_days} working days to ensure proper fabric settling, stitching, and finishing.",
                f"Includes dedicated line time across {', '.join(stages)} and final batch packaging.",
            ]
            proposed_action = (
                f"Our standard feasible delivery timeline is {lead_days} calendar days from order confirmation. "
                "For urgent deadlines, we can evaluate factory shift overtime or partial split-shipment subject to floor supervisor approval."
            )

        # 4. Payment terms query or objection
        elif intent == CustomerIntent.PAYMENT_QUERY or "payment" in msg_lower or "credit" in msg_lower or "net" in msg_lower:
            objection_type = "PAYMENT_TERMS"
            terms = customer_profile.paymentTerms
            value_drivers = [
                f"Authorized standard terms for your account tier ({customer_profile.customerCategory}): {terms}.",
                "Working capital structure directly supports rapid yarn procurement and uninterrupted machine scheduling.",
            ]
            proposed_action = (
                f"Your currently configured commercial payment terms are '{terms}'. "
                "Extended credit arrangements (e.g. Net 45/60) can be submitted for executive credit committee approval."
            )

        # 5. Bulk volume discount query
        elif "bulk" in msg_lower or "larger order" in msg_lower or "volume" in msg_lower:
            objection_type = "BULK_VOLUME"
            value_drivers = [
                "Machine setup times and dye-lot preparation costs amortize favorably across larger batch sizes.",
                "Bulk yarn purchasing commands lower spot procurement rates.",
            ]
            proposed_action = (
                f"For an increase of 25% to 50% in order volume (e.g. {int(quantity * 1.5):,} units), "
                "we can offer additional tier discounts up to 5-8% off standard unit prices."
            )

        # 6. Minimum Order Quantity (MOQ)
        elif "moq" in msg_lower or "minimum order" in msg_lower or "smaller quantity" in msg_lower:
            objection_type = "MOQ_REDUCTION"
            value_drivers = [
                "Factory cutting table spreads and industrial sewing line changeovers require minimum continuous run lots.",
            ]
            proposed_action = (
                f"The current order quantity of {quantity:,} units is optimized for continuous production efficiency. "
                "Lower lot sizes increase per-unit setup overhead, but we can explore co-scheduling with an upcoming production batch."
            )

        # 7. Counter offer / Discount request
        elif target_price is not None:
            objection_type = "COUNTER_OFFER"
            if target_price < minimum_authorized:
                value_drivers = [
                    f"Requested rate of ₹{target_price:.2f}/unit is below current authorized factory floor pricing.",
                    "Maintaining factory quality assurance and compliant production requires a viable commercial baseline.",
                ]
                proposed_action = (
                    f"While ₹{target_price:.2f} is below our authorized threshold, we can offer our best authorized price "
                    f"of ₹{minimum_authorized:.2f}/unit, or formally submit your request to executive management for special review."
                )
            else:
                value_drivers = [
                    f"Target rate of ₹{target_price:.2f}/unit is within reviewable commercial range.",
                ]
                proposed_action = f"We have reviewed your request and adjusted our offer to ₹{current_offer:.2f}/unit."

        return {
            "objectionType": objection_type,
            "valueDrivers": value_drivers,
            "proposedAction": proposed_action,
            "productName": product_name,
            "quantity": quantity,
            "originalPrice": original_price,
            "currentOffer": current_offer,
            "minimumAuthorized": minimum_authorized,
            "targetPrice": target_price,
            "customerCategory": customer_profile.customerCategory,
        }

