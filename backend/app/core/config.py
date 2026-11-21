"""
Application settings.

Values are read from environment variables or from the `.env` file in the
backend folder. `.env` holds secrets (API keys) and is never committed to git;
`.env.example` shows which variables exist.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AI Learning Assistant API"
    environment: str = "development"

    # PostgreSQL (Postgres.app). With no user/password in the URL, psycopg
    # connects as your macOS user, which Postgres.app trusts locally.
    database_url: str = "postgresql+psycopg://localhost:5432/diploma"

    # The Next.js site allowed to call this API from the browser (CORS).
    frontend_origin: str = "http://localhost:3000"

    # Login. SECRET_KEY signs the login tokens — anyone who knows it could
    # create valid tokens, so it lives only in .env. No default on purpose.
    secret_key: SecretStr = Field(min_length=32)
    access_token_minutes: int = 60 * 24 * 7  # stay logged in for 7 days
    auth_cookie_name: str = "access_token"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    # Course materials. Files are stored on disk (git-ignored `data/` folder);
    # the embedding model (~220 MB) is downloaded once into `data/models/`.
    upload_dir: Path = _BACKEND_DIR / "data" / "uploads"
    model_cache_dir: Path = _BACKEND_DIR / "data" / "models"
    max_upload_mb: int = 50
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

    # LLM (answer router step 5). The provider is pluggable so it can be
    # switched (gemini / ollama / claude …) without code changes.
    llm_provider: str = "gemini"
    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-3.5-flash"
    gemini_fallback_model: str = "gemini-3.5-flash-lite"
    llm_timeout_seconds: int = 45  # then the fallback model is tried

    # Answer router thresholds (cosine similarity, 0…1). Measured on F.CSM101 in M2c;
    # see docs/PLAN.md. Tuned further in the evaluation (M7).
    faq_threshold: float = (
        0.75  # FAQ question means the same → teacher's answer (right: 0.79–1.0, wrong: ≤0.56)
    )
    cache_threshold: float = 0.92  # cached question means the same → reuse answer
    retrieval_threshold: float = 0.40  # best passage below this → "not in the materials"
    retrieval_top_k: int = 5  # passages given to the LLM


@lru_cache
def get_settings() -> Settings:
    """Read settings once and reuse them (cached)."""
    return Settings()
