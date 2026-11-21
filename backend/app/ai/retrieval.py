"""
Search by meaning inside one course.

The question is turned into a vector, and pgvector finds the stored vectors that
point in the most similar direction (cosine distance, the `<=>` operator; the
HNSW index makes it fast). similarity = 1 - distance: 1.0 = same meaning, ~0 = unrelated.

Used now by the teacher's "test search" page, and in M3 by the answer router
(step 2: teacher FAQ, step 4: retrieval gate, step 5: context for the LLM).
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai import embeddings
from app.models import Chunk, FaqItem, Material, MaterialStatus


@dataclass
class FaqHit:
    item: FaqItem
    similarity: float


@dataclass
class ChunkHit:
    chunk: Chunk
    filename: str
    similarity: float


def embed_query(text: str) -> list[float]:
    return embeddings.embed_texts([text])[0]


def search_faq(db: Session, course_id: int, vector: list[float], limit: int = 3) -> list[FaqHit]:
    distance = FaqItem.embedding.cosine_distance(vector)
    rows = db.execute(
        select(FaqItem, distance)
        .where(FaqItem.course_id == course_id)
        .order_by(distance)
        .limit(limit)
    )
    return [FaqHit(item, round(1 - float(d), 4)) for item, d in rows]


def search_chunks(
    db: Session, course_id: int, vector: list[float], limit: int = 5
) -> list[ChunkHit]:
    distance = Chunk.embedding.cosine_distance(vector)
    rows = db.execute(
        select(Chunk, Material.filename, distance)
        .join(Material, Material.id == Chunk.material_id)
        .where(Chunk.course_id == course_id, Material.status == MaterialStatus.ready)
        .order_by(distance)
        .limit(limit)
    )
    return [ChunkHit(chunk, filename, round(1 - float(d), 4)) for chunk, filename, d in rows]
