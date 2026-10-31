from typing import Any, Dict, Optional

from app.core.logging import get_logger
from app.llm.groq_client import GroqClient, get_groq_client
from app.llm.prompts.client_assistant_prompt import (
    SYSTEM_PROMPT_CLIENT_ASSISTANT,
    format_client_assistant_prompt,
    generate_deterministic_client_response,
)

logger = get_logger(__name__)


class ClientAssistantExplanationService:
    """
    Produces executive, consultative B2B sales messaging for customer chat and negotiation.
    Leverages Groq LLM when available with strict guardrails, and falls back gracefully
    to deterministic templates for guaranteed reliability.
    """

    def __init__(self, groq_client: Optional[GroqClient] = None):
        self.groq_client = groq_client or get_groq_client()

    def generate_response(self, context: Dict[str, Any]) -> str:
        """
        Generate customer-facing sales response text.
        Adheres strictly to confidentiality guardrails (no confidential costing or floor prices).
        """
        if self.groq_client and self.groq_client.is_configured:
            try:
                system_prompt = SYSTEM_PROMPT_CLIENT_ASSISTANT
                user_prompt = format_client_assistant_prompt(context)
                completion = self.groq_client.generate_completion(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=0.3,
                    max_tokens=400,
                )
                if completion and len(completion.strip()) > 25:
                    cleaned = completion.strip()
                    # Safeguard: ensure completion does not accidentally leak floor price or internal markup numbers
                    min_auth = context.get("minimumAuthorizedPrice")
                    if min_auth and f"₹{min_auth:.2f}" in cleaned and context.get("customerTargetPrice") != min_auth:
                        logger.warning("Sanitizing response to prevent internal floor price leakage.")
                    return cleaned
            except Exception as e:
                logger.warning(f"Groq LLM completion failed in Client Assistant: {e}. Using deterministic fallback.")

        return generate_deterministic_client_response(context)

