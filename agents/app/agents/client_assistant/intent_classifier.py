import re
from typing import Any, Dict, Optional, Tuple

from app.core.logging import get_logger
from app.schemas.client_assistant_schema import CustomerIntent

logger = get_logger(__name__)


class IntentClassifier:
    """
    Robust intent classification and entity extraction service for B2B manufacturing sales.
    Combines rule-based pattern matching and linguistic heuristics with 100% deterministic reliability.
    """

    def classify_and_extract(
        self,
        message: str,
        current_price: float,
    ) -> Tuple[CustomerIntent, Dict[str, Any]]:
        """
        Analyze customer natural language message to identify negotiation intent
        and extract numerical parameters (target price, discount %, quantity).
        """
        text = message.strip()
        entities = self._extract_entities(text, current_price)

        intent = self._classify_intent(text, entities, current_price)
        return intent, entities

    def _classify_intent(self, text: str, entities: Dict[str, Any], current_price: float = 0.0) -> CustomerIntent:
        """Classify message intent based on priority order and semantic markers."""
        lower = text.lower()

        # 1. Acceptance
        if self._matches_acceptance(lower):
            return CustomerIntent.ACCEPTANCE

        # 2. Rejection / Walk away
        if self._matches_rejection(lower):
            return CustomerIntent.REJECTION

        # 3. Explicit Counter-offer (contains target price or specific counter number)
        target_p = entities.get("targetPrice")
        if target_p is not None:
            # If target price matches current price and customer asked to reduce, treat as discount request
            if abs(target_p - current_price) < 0.01 and self._matches_discount_request(lower):
                entities.pop("targetPrice", None)
                return CustomerIntent.DISCOUNT_REQUEST
            return CustomerIntent.COUNTER_OFFER

        # 4. Cost and Margin Inquiry
        if self._matches_cost_inquiry(lower):
            return CustomerIntent.COST_INQUIRY

        # 5. Product or Specification Change
        if self._matches_product_change(lower):
            return CustomerIntent.PRODUCT_CHANGE_REQUEST

        # 5. Delivery and Schedule Query
        if self._matches_delivery(lower):
            return CustomerIntent.DELIVERY_QUERY

        # 6. Payment and Commercial Terms Query
        if self._matches_payment(lower):
            return CustomerIntent.PAYMENT_QUERY

        # 7. Discount Request (asking for price reduction / discount percentage)
        if self._matches_discount_request(lower) or entities.get("discountPct") is not None:
            return CustomerIntent.DISCOUNT_REQUEST

        # 8. Price Objection (stating price is high without asking explicitly for concession)
        if self._matches_price_objection(lower):
            return CustomerIntent.PRICE_OBJECTION

        # 9. General Manufacturing / Product Query
        if self._matches_general_query(lower):
            return CustomerIntent.GENERAL_QUERY

        return CustomerIntent.OTHER

    def _matches_acceptance(self, text: str) -> bool:
        patterns = [
            r"\b(?:accept|accepted|agree|agreed|sounds good|deal|proceed|confirm|go ahead)\b",
            r"\b(?:finalize|book the order|let's do it|ready to place|place the order)\b",
            r"\b(?:we are happy with (?:the|this) price)\b",
        ]
        return any(re.search(p, text) for p in patterns)

    def _matches_rejection(self, text: str) -> bool:
        patterns = [
            r"\b(?:cancel|decline|declined|reject|rejected|cannot accept|can't accept)\b",
            r"\b(?:walk away|look elsewhere|not interested|too expensive, bye|drop this)\b",
        ]
        return any(re.search(p, text) for p in patterns)

    def _matches_cost_inquiry(self, text: str) -> bool:
        patterns = [
            r"\b(?:cost breakdown|costing breakdown|cost split|breakdown of cost)\b",
            r"\b(?:profit margin|your margin|margin percentage|markup)\b",
            r"\b(?:internal cost|factory cost|production cost|manufacturing cost|raw material cost)\b",
            r"\b(?:break down (?:the|your) cost|what (?:is|are) your (?:cost|costs|margins))\b",
        ]
        return any(re.search(p, text) for p in patterns)

    def _matches_product_change(self, text: str) -> bool:
        patterns = [
            r"\b(?:alternative|fabric|blend|material|specification|specs|gsm)\b",
            r"\b(?:change the fabric|cheaper material|different fabric|polyester blend)\b",
            r"\b(?:change product|different configuration|customization|quality grade)\b",
        ]
        return any(re.search(p, text) for p in patterns)

    def _matches_delivery(self, text: str) -> bool:
        patterns = [
            r"\b(?:delivery|deliver|lead time|dispatch|shipment|timeline|schedule)\b",
            r"\b(?:how soon|how fast|earlier date|expedite|deadline|rush order)\b",
        ]
        return any(re.search(p, text) for p in patterns)

    def _matches_payment(self, text: str) -> bool:
        patterns = [
            r"\b(?:payment|terms|credit|net 30|net 45|net 60|advance|installment)\b",
            r"\b(?:pay after delivery|deferred payment|lc|letter of credit)\b",
        ]
        return any(re.search(p, text) for p in patterns)

    def _matches_discount_request(self, text: str) -> bool:
        patterns = [
            r"\b(?:reduce|reduce the price|lower|lower the price|discount|concession)\b",
            r"\b(?:better price|best price|cheaper price|can you do better|give us a discount)\b",
            r"\b(?:price cut|margin cut|can you offer a discount|can you reduce)\b",
        ]
        return any(re.search(p, text) for p in patterns)

    def _matches_price_objection(self, text: str) -> bool:
        patterns = [
            r"\b(?:expensive|costly|price is high|too high|over budget|budget issue)\b",
            r"\b(?:another supplier|competitor|other vendor|market rate is lower)\b",
            r"\b(?:higher than expected|pricey|not within our budget)\b",
        ]
        return any(re.search(p, text) for p in patterns)

    def _matches_general_query(self, text: str) -> bool:
        patterns = [
            r"\b(?:what is|tell me|explain|why|breakdown|costing|details|information)\b",
            r"\b(?:how is|quality|stitching|packing|tolerance|certificate)\b",
        ]
        return any(re.search(p, text) for p in patterns)

    def _extract_entities(self, text: str, current_price: float) -> Dict[str, Any]:
        """Extract target price, discount percentage, and quantity from message."""
        entities: Dict[str, Any] = {}

        # 1. Relative reduction extraction: e.g. "reduce by another ₹10", "cut by ₹15"
        reduction_pattern = r"(?:reduce|cut|discount|lower|drop)(?:\s+it)?\s+by\s+(?:another\s+)?(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]+)?)"
        m_red = re.search(reduction_pattern, text, re.IGNORECASE)
        if m_red and "%" not in text[m_red.start():m_red.end() + 2]:
            try:
                reduction_val = float(m_red.group(1))
                if 0 < reduction_val < current_price:
                    entities["targetPrice"] = round(current_price - reduction_val, 2)
            except ValueError:
                pass

        # 2. Target price extraction (if not already found by relative reduction)
        if "targetPrice" not in entities:
            price_patterns = [
                r"(?:₹|rs\.?|inr)\s*([0-9]+(?:\.[0-9]+)?)",  # ₹225, Rs 225, INR 225
                r"(?:at|for|to|around|target|offer|budget)\s*(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:per unit|/unit|each|piece)?",
                r"([0-9]+(?:\.[0-9]+)?)\s*(?:per unit|/unit|each|piece)",
                r"(?:match|give it at)\s*([0-9]+(?:\.[0-9]+)?)",
            ]

            found_prices = []
            for pat in price_patterns:
                matches = re.finditer(pat, text, re.IGNORECASE)
                for m in matches:
                    try:
                        # Check if matched number is preceded by negative rejection (e.g. "cannot do ₹235")
                        start_pos = m.start()
                        preceding = text[max(0, start_pos - 25):start_pos].lower()
                        if re.search(r"\b(?:cannot|can't|unable to|not able to|not)\s+do\s*$", preceding):
                            continue

                        # Check if matched number is followed by quantity words (e.g. 500 cotton T-shirts)
                        end_pos = m.end()
                        remaining = text[end_pos:end_pos + 25].lower()
                        if re.match(r"^\s*(?:cotton\s+)?(?:units|pcs|pieces|t-shirts|shirts|meters|kg|cones|garments)\b", remaining):
                            continue
                        val = float(m.group(1))
                        # Plausible unit price check (e.g. > 40% of current_price and < 50000)
                        if (current_price * 0.4) <= val <= 50000.0:
                            found_prices.append(val)
                    except ValueError:
                        pass

            if found_prices:
                diff_prices = [p for p in found_prices if abs(p - current_price) >= 0.01]
                if diff_prices:
                    chosen = min(diff_prices, key=lambda p: abs(p - current_price))
                else:
                    chosen = found_prices[0]
                entities["targetPrice"] = round(chosen, 2)

        # 2. Discount percentage extraction
        disc_patterns = [
            r"([0-9]+(?:\.[0-9]+)?)\s*%\s*(?:discount|off|reduction|concession|cut)?",
            r"(?:discount of|reduce by|cut by)\s*([0-9]+(?:\.[0-9]+)?)\s*%",
        ]
        for pat in disc_patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                try:
                    pct = float(m.group(1))
                    if 0.5 <= pct <= 60.0:
                        entities["discountPct"] = round(pct, 2)
                        # If discount % given, compute implied target price if not already set
                        if "targetPrice" not in entities and current_price > 0:
                            implied = current_price * (1.0 - (pct / 100.0))
                            entities["targetPrice"] = round(implied, 2)
                        break
                except ValueError:
                    pass

        # 3. Quantity extraction
        qty_pattern = r"(?:order|buy|take|quantity of|volume of)?\s*([0-9]+(?:,[0-9]{3})*)\s*(?:units|pcs|pieces|t-shirts|shirts)"
        m_qty = re.search(qty_pattern, text, re.IGNORECASE)
        if m_qty:
            try:
                q_str = m_qty.group(1).replace(",", "")
                entities["requestedQuantity"] = int(q_str)
            except ValueError:
                pass

        return entities

