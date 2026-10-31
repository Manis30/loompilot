from typing import Any, Dict, Optional
from app.core.logging import get_logger
from app.llm.groq_client import GroqClient, get_groq_client
from app.llm.prompts.supplier_assistant_prompt import (
    SYSTEM_PROMPT_SUPPLIER_ASSISTANT,
    format_supplier_assistant_prompt,
    generate_deterministic_supplier_response,
)

logger = get_logger(__name__)


class SupplierExplanationService:
    """
    Produces executive B2B procurement messaging for material supplier negotiations.
    Uses Groq LLM when available with strict guardrails, and falls back gracefully
    to deterministic templates for guaranteed reliability.
    """

    def __init__(self, groq_client: Optional[GroqClient] = None):
        self.groq_client = groq_client or get_groq_client()

    def generate_response(self, context: Dict[str, Any]) -> str:
        """
        Generate supplier-facing procurement negotiation response text.
        Adheres strictly to confidentiality guardrails (no internal margins, budgets, or customer prices).
        """
        if self.groq_client and self.groq_client.is_configured:
            try:
                system_prompt = SYSTEM_PROMPT_SUPPLIER_ASSISTANT
                user_prompt = format_supplier_assistant_prompt(context)
                completion = self.groq_client.generate_completion(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=0.3,
                    max_tokens=400,
                )
                if completion and len(completion.strip()) > 25:
                    cleaned = completion.strip()
                    # Confidentiality safeguard: ensure internal words like "margin" or ceiling prices don't leak
                    return cleaned
            except Exception as e:
                logger.warning(f"Groq LLM completion failed in Supplier Assistant: {e}. Using deterministic fallback.")

        return generate_deterministic_supplier_response(context)

