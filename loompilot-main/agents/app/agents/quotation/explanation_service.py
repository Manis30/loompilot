from typing import Any, Dict, Optional

from app.core.logging import get_logger
from app.llm.groq_client import GroqClient, get_groq_client
from app.llm.prompts.quotation_prompt import (
    SYSTEM_PROMPT_QUOTATION_EXPLANATION,
    format_quotation_prompt,
    generate_deterministic_quotation_explanation,
)

logger = get_logger(__name__)


class QuotationExplanationService:
    """
    Produces executive-level business reasoning for manufacturing quotations using Groq LLM
    with high-quality deterministic fallback for offline or unconfigured environments.
    """

    def __init__(self, groq_client: Optional[GroqClient] = None):
        self.groq_client = groq_client or get_groq_client()

    def generate_explanation(self, data: Dict[str, Any]) -> str:
        """
        Generate plain-language explanation of bottom-up cost breakdown and commercial terms.
        """
        if self.groq_client and self.groq_client.is_configured:
            try:
                system_prompt = SYSTEM_PROMPT_QUOTATION_EXPLANATION
                user_prompt = format_quotation_prompt(data)
                completion = self.groq_client.generate_completion(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=0.2,
                    max_tokens=450,
                )
                if completion and len(completion.strip()) > 30:
                    return completion.strip()
            except Exception as e:
                logger.warning(f"Groq LLM explanation generation failed: {e}. Using deterministic fallback.")

        return generate_deterministic_quotation_explanation(data)

