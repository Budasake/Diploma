"""
The LLM — step 5 of the answer router, used only when no cheaper step could answer.

The rest of the app only calls `stream_chat()`, so the provider can be switched
in `.env` (LLM_PROVIDER) without touching the router. Gemini is implemented now;
others (Ollama for a local model, Claude) can be added as another branch.

Gemini settings:
- "thinking" is turned off (thinking_budget=0): measured on gemini-3.5-flash, it
  made answers ~3x slower and used the output budget on hidden reasoning.
- If the main model is busy (HTTP 503/429) before it has written anything, the
  fallback model is tried once.
"""

from collections.abc import Iterator
from dataclasses import dataclass

from app.core.config import get_settings


class LLMError(Exception):
    """The LLM could not answer (busy, quota used up, network, not configured)."""


@dataclass
class ChatTurn:
    role: str  # "user" or "assistant"
    text: str


@dataclass
class LLMStream:
    """Iterate to get pieces of the answer; afterwards `model` and token counts are set."""

    pieces: Iterator[str]
    model: str = ""
    prompt_tokens: int | None = None
    output_tokens: int | None = None

    def __iter__(self) -> Iterator[str]:
        yield from self.pieces


def stream_chat(system: str, turns: list[ChatTurn]) -> LLMStream:
    provider = get_settings().llm_provider
    if provider == "gemini":
        return _gemini_stream(system, turns)
    raise LLMError(f"LLM provider '{provider}' is not implemented")


# ---------- Gemini ----------

_client = None


def _gemini_client():
    global _client
    if _client is None:
        from google import genai
        from google.genai import types

        settings = get_settings()
        if settings.gemini_api_key is None:
            raise LLMError("GEMINI_API_KEY is not set")
        _client = genai.Client(
            api_key=settings.gemini_api_key.get_secret_value(),
            http_options=types.HttpOptions(
                timeout=settings.llm_timeout_seconds * 1000,
                retry_options=types.HttpRetryOptions(attempts=1),  # we retry ourselves
            ),
        )
    return _client


def _gemini_stream(system: str, turns: list[ChatTurn]) -> LLMStream:
    from google.genai import errors, types

    settings = get_settings()
    client = _gemini_client()
    contents = [
        types.Content(
            role="model" if t.role == "assistant" else "user",
            parts=[types.Part(text=t.text)],
        )
        for t in turns
    ]
    config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=0.2,  # low = sticks to the sources, less "creative"
        max_output_tokens=1200,
        thinking_config=types.ThinkingConfig(thinking_budget=0),
    )
    stream = LLMStream(pieces=iter(()))

    def pieces() -> Iterator[str]:
        models = [settings.gemini_model, settings.gemini_fallback_model]
        for attempt, model in enumerate(m for m in models if m):
            wrote_anything = False
            try:
                stream.model = model
                for chunk in client.models.generate_content_stream(
                    model=model, contents=contents, config=config
                ):
                    if chunk.usage_metadata:
                        stream.prompt_tokens = chunk.usage_metadata.prompt_token_count
                        stream.output_tokens = chunk.usage_metadata.candidates_token_count
                    if chunk.text:
                        wrote_anything = True
                        yield chunk.text
                return
            except errors.APIError as exc:
                busy = exc.code in (429, 503)
                if busy and not wrote_anything and attempt == 0:
                    continue  # try the fallback model
                raise LLMError(f"gemini {exc.code}: {exc.message}") from exc
            except Exception as exc:  # network errors, timeouts
                if not wrote_anything and attempt == 0:
                    continue  # e.g. the main model timed out: try the fallback model
                raise LLMError(f"gemini: {type(exc).__name__}: {exc}") from exc
        raise LLMError("gemini: all models busy or none configured")

    stream.pieces = pieces()
    return stream
