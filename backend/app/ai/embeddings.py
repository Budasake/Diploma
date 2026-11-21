"""
Embeddings: turn text into a list of 384 numbers that represents its *meaning*.

Texts with similar meaning get vectors that point in a similar direction, so
"Өгөгдлийн сан гэж юу вэ?" lands close to a paragraph that explains databases,
even if the exact words differ. pgvector then finds the closest chunks quickly.

The model runs locally on the CPU (fastembed + ONNX): free, no API key, no
student text leaves the server. It is loaded once, on first use, and reused.
"""

import threading

from fastembed import TextEmbedding

from app.core.config import get_settings
from app.models.material import EMBEDDING_DIM

_model: TextEmbedding | None = None
_lock = threading.Lock()


def get_model() -> TextEmbedding:
    global _model
    if _model is None:
        with _lock:  # two uploads at once must not load the model twice
            if _model is None:
                settings = get_settings()
                settings.model_cache_dir.mkdir(parents=True, exist_ok=True)
                _model = TextEmbedding(
                    settings.embedding_model, cache_dir=str(settings.model_cache_dir)
                )
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """One vector per text, in the same order."""
    if not texts:
        return []
    vectors = [v.tolist() for v in get_model().embed(texts, batch_size=32)]
    if len(vectors[0]) != EMBEDDING_DIM:
        raise RuntimeError(f"embedding model returned {len(vectors[0])} dims, need {EMBEDDING_DIM}")
    return vectors
