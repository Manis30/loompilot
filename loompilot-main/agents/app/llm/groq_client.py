import os
from typing import Any, Dict, List, Optional
from groq import Groq

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class GroqClient:
    """
    Client wrapper for interacting with Groq LLM API.
    Handles authentication, error recovery, and graceful degradation when API key is missing.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        if api_key is not None:
            self.api_key = api_key
        else:
            self.api_key = settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY")
        self.model = model or settings.GROQ_MODEL
        self.timeout = timeout or settings.GROQ_TIMEOUT_SECONDS
        self._client: Optional[Groq] = None

        if self.is_configured:
            try:
                import httpx
                t_obj = httpx.Timeout(self.timeout, connect=2.0)
                self._client = Groq(api_key=self.api_key, timeout=t_obj, max_retries=0)
                logger.info(f"Groq client initialized with model: {self.model}")
            except Exception as e:
                logger.warning(f"Failed to initialize Groq client: {e}")
                self._client = None
        else:
            logger.info("Groq API key not configured; client will operate in fallback mode.")

    @property
    def is_configured(self) -> bool:
        """Check whether valid API key is present."""
        if os.environ.get("DISABLE_GROQ", "").lower() in ("true", "1", "yes"):
            return False
        return bool(self.api_key and self.api_key.strip() and self.api_key != "your_groq_api_key_here")

    def generate_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 400,
    ) -> Optional[str]:
        """
        Generate completion using Groq LLM.
        Returns None if client is not configured or an error occurs.
        """
        if not self.is_configured or self._client is None:
            return None

        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
            response = self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            content = response.choices[0].message.content
            return content.strip() if content else None
        except Exception as e:
            logger.warning(f"Groq API completion call failed: {e}. Falling back to rule-based explanation.")
            return None

    def check_health(self) -> Dict[str, Any]:
        """Verify Groq API connectivity without leaking secrets."""
        if not self.is_configured:
            return {
                "configured": False,
                "connected": False,
                "model": self.model,
                "status": "API key not set in environment or .env file",
            }

        try:
            # Minimal latency probe
            test_resp = self.generate_completion(
                system_prompt="You are a system health check.",
                user_prompt="Reply with the word 'OK'.",
                max_tokens=5,
            )
            if test_resp and "OK" in test_resp.upper():
                return {
                    "configured": True,
                    "connected": True,
                    "model": self.model,
                    "status": "connected",
                }
            return {
                "configured": True,
                "connected": False,
                "model": self.model,
                "status": "invalid API key or unverified response",
            }
        except Exception as e:
            return {
                "configured": True,
                "connected": False,
                "model": self.model,
                "status": f"connection failed: {str(e)}",
            }


_groq_instance: Optional[GroqClient] = None


def get_groq_client() -> GroqClient:
    """Return the global GroqClient singleton."""
    global _groq_instance
    if _groq_instance is None:
        _groq_instance = GroqClient()
    return _groq_instance
