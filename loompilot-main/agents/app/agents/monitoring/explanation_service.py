from typing import Any, Dict, Optional

from app.core.logging import get_logger
from app.llm.groq_client import GroqClient, get_groq_client
from app.llm.prompts.monitoring_prompt import (
    SYSTEM_PROMPT_MONITORING,
    format_monitoring_prompt,
    generate_deterministic_monitoring_response,
)

logger = get_logger(__name__)


class MonitoringExplanationService:
    """
    Produces executive plant management communications for the Monitoring AI Agent.
    Leverages Groq LLM with strict factual guardrails when available, and smoothly
    falls back to deterministic templates for zero hallucinations and guaranteed reliability.
    """

    def __init__(self, groq_client: Optional[GroqClient] = None):
        self.groq_client = groq_client or get_groq_client()

    def generate_response(self, context: Dict[str, Any]) -> str:
        """
        Generate operational response text grounded strictly in verified factory data.
        """
        import os
        if os.environ.get("DISABLE_GROQ", "").lower() in ("true", "1", "yes"):
            return generate_deterministic_monitoring_response(context)

        if self.groq_client and self.groq_client.is_configured:
            try:
                system_prompt = SYSTEM_PROMPT_MONITORING
                user_prompt = format_monitoring_prompt(context)
                completion = self.groq_client.generate_completion(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=0.2,
                    max_tokens=600,
                )
                if completion and len(completion.strip()) > 30:
                    return completion.strip()
            except Exception as e:
                logger.warning(f"Groq completion failed in Monitoring Agent: {e}. Falling back to deterministic response.")

        return generate_deterministic_monitoring_response(context)
