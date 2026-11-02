import re
from typing import Any, Dict, Optional, Tuple
from app.core.logging import get_logger
from app.schemas.supplier_assistant_schema import SupplierNegotiationIntent

logger = get_logger(__name__)


class SupplierIntentClassifier:
    """
    Deterministic natural language intent classifier and entity extractor
    tailored for B2B raw material procurement negotiations.
    """

    def classify_and_extract(
        self,
        message: str,
        current_counter_price: Optional[float] = None,
    ) -> Tuple[SupplierNegotiationIntent, Dict[str, Any]]:
        """
        Analyze incoming supplier text message, extract numeric parameters,
        and classify the primary negotiation intent.
        """
        text = message.strip()
        entities = self._extract_entities(text)
        intent = self._classify_intent(text, entities)
        return intent, entities

    def _classify_intent(self, text: str, entities: Dict[str, Any]) -> SupplierNegotiationIntent:
        lower = text.lower()

        # 1. Acceptance
        if self._matches_acceptance(lower):
            return SupplierNegotiationIntent.ACCEPTANCE

        # 2. Rejection / Walk away
        if self._matches_rejection(lower):
            return SupplierNegotiationIntent.REJECTION

        # 3. Quality / Specification Variation (lower GSM, different grade)
        if entities.get("proposedGsm") is not None or self._matches_quality_variation(lower):
            return SupplierNegotiationIntent.QUALITY_VARIATION

        # 4. Bulk / Tiered Volume Discount Offer
        if entities.get("bulkPrice") is not None or self._matches_bulk_discount(lower):
            return SupplierNegotiationIntent.BULK_DISCOUNT_OFFER

        # 5. Price Increase / Shortage claim
        if entities.get("isShortageClaim") or self._matches_price_increase(lower):
            return SupplierNegotiationIntent.PRICE_INCREASE

        # 6. Payment terms discount negotiation
        if self._matches_payment_terms(lower):
            return SupplierNegotiationIntent.PAYMENT_TERM_DISCOUNT

        # 7. Counter Offer or Quote Submission with explicit price
        if entities.get("offeredPrice") is not None:
            if any(w in lower for w in ["counter", "our best", "cannot do", "instead", "revise", "firm offer"]):
                return SupplierNegotiationIntent.COUNTER_OFFER
            return SupplierNegotiationIntent.QUOTE_SUBMISSION

        # 8. General inquiry
        if any(w in lower for w in ["lead time", "delivery", "spec", "specifications", "status", "moq"]):
            return SupplierNegotiationIntent.GENERAL_QUERY

        return SupplierNegotiationIntent.OTHER

    def _matches_acceptance(self, text: str) -> bool:
        if re.search(r"\b(?:cannot|can't|won't|will not|do not|don't)\s+(?:accept|agree)\b", text):
            return False
        patterns = [
            r"\b(?:we accept|accepted|we agree|agreed|deal|confirmed)\b",
            r"\b(?:happy to proceed|lock the price|ready to dispatch at|we will match)\b",
            r"\b(?:agree to supply at your counter|we accept your counter)\b",
        ]
        return any(re.search(p, text) for p in patterns)

    def _matches_rejection(self, text: str) -> bool:
        patterns = [
            r"\b(?:reject|rejected|cannot accept|can't accept|not possible|decline|declined)\b",
            r"\b(?:walk away|cancel|unviable|cannot supply at this rate)\b",
        ]
        return any(re.search(p, text) for p in patterns)

    def _matches_quality_variation(self, text: str) -> bool:
        patterns = [
            r"\b(?:lower gsm|different gsm|gsm|grade|carded|combed|spec variation|lower grade)\b",
            r"\b(?:alternative quality|different quality|160 gsm|140 gsm|substitute fabric)\b",
        ]
        return any(re.search(p, text) for p in patterns)

    def _matches_bulk_discount(self, text: str) -> bool:
        patterns = [
            r"\b(?:bulk discount|volume discount|tier|tiered|volume pricing)\b",
            r"\b(?:if you order|for \d+ kg|for \d+ units|larger order)\b",
        ]
        return any(re.search(p, text) for p in patterns)

    def _matches_price_increase(self, text: str) -> bool:
        patterns = [
            r"\b(?:shortage|scarcity|price increase|raising price|rate hike|supply constraint)\b",
            r"\b(?:costs have increased|raw material surge|unprecedented spike)\b",
        ]
        return any(re.search(p, text) for p in patterns)

    def _matches_payment_terms(self, text: str) -> bool:
        patterns = [
            r"\b(?:payment terms|cash discount|early payment|net 15|net 30|advance payment)\b",
            r"\b(?:15 days|credit terms|prompt payment)\b",
        ]
        return any(re.search(p, text) for p in patterns)

    def _extract_entities(self, text: str) -> Dict[str, Any]:
        entities: Dict[str, Any] = {}

        # 1. Shortage claim marker
        shortage_keywords = ["shortage", "scarcity", "constraint", "spike", "price surge", "supply disruption"]
        if any(w in text.lower() for w in shortage_keywords):
            entities["isShortageClaim"] = True

        # 2. Fabric weight GSM extraction (e.g. 160 GSM, 180 GSM)
        gsm_match = re.search(r"(\d{2,3})\s*(?:gsm|GSM)\b", text)
        if gsm_match:
            try:
                entities["proposedGsm"] = float(gsm_match.group(1))
            except ValueError:
                pass

        # 3. Bulk discount comparison extraction: e.g. "₹180/kg for 2,000 kg vs ₹185 for 500 kg"
        bulk_pattern = r"(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:/kg|per kg|each)?\s*for\s*(\d+(?:,\d+)?)\s*(?:kg|units|meters)[\s\w]*(?:vs|compared to|against|from)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:/kg|per kg|each)?\s*for\s*(\d+(?:,\d+)?)"
        m_bulk = re.search(bulk_pattern, text, re.IGNORECASE)
        if m_bulk:
            try:
                entities["bulkPrice"] = float(m_bulk.group(1))
                entities["bulkQuantity"] = float(m_bulk.group(2).replace(",", ""))
                entities["basePrice"] = float(m_bulk.group(3))
                entities["baseQuantity"] = float(m_bulk.group(4).replace(",", ""))
                entities["offeredPrice"] = entities["bulkPrice"]
            except ValueError:
                pass

        # 4. Standard price extraction if bulk pattern not matched
        if "offeredPrice" not in entities:
            # Match prices like "₹210/kg", "Rs 210", "210 per kg", "at 210"
            price_patterns = [
                r"(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)\s*(?:/kg|per kg|each|per unit)?",
                r"(?:at|price of|quote|rate of)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:/kg|per kg|each)?",
                r"(\d+(?:\.\d+)?)\s*(?:/kg|per kg)",
            ]
            prices = []
            for pat in price_patterns:
                for match in re.finditer(pat, text, re.IGNORECASE):
                    try:
                        p = float(match.group(1))
                        if 10.0 <= p <= 10000.0:
                            prices.append(p)
                    except ValueError:
                        pass
            if prices:
                entities["offeredPrice"] = prices[0]

        # 5. Quantity extraction (e.g. 500 kg, 2000 kg, 1,000 units)
        qty_match = re.search(r"(\d+(?:,\d+)?)\s*(?:kg|kgs|cones|pieces|meters|units)\b", text, re.IGNORECASE)
        if qty_match:
            try:
                entities["quantity"] = float(qty_match.group(1).replace(",", ""))
            except ValueError:
                pass

        # 6. Payment terms
        if re.search(r"\b15\s*days\b", text, re.IGNORECASE):
            entities["paymentTerms"] = "15 Days"
        elif re.search(r"\bnet\s*30\b", text, re.IGNORECASE):
            entities["paymentTerms"] = "Net 30"
        elif re.search(r"\badvance\b", text, re.IGNORECASE):
            entities["paymentTerms"] = "Advance"

        return entities
