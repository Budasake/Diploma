"""
"Test search" for teachers: type a question and see what the system would find —
the closest FAQ questions and the closest passages in the materials, with their
similarity scores. This is exactly the data the answer router (M3) will use, so
it also helps choose its thresholds.
"""

from typing import Annotated

from fastapi import APIRouter, Query

from app.ai.retrieval import embed_query, search_chunks, search_faq
from app.api.courses import get_managed_course
from app.api.deps import CurrentUser, DbSession
from app.schemas.faq import ChunkHitOut, FaqHitOut, SearchOut

router = APIRouter(prefix="/courses/{course_id}/search", tags=["search"])


@router.get("", response_model=SearchOut)
def search_course(
    course_id: int,
    q: Annotated[str, Query(min_length=2, max_length=500)],
    user: CurrentUser,
    db: DbSession,
) -> SearchOut:
    course = get_managed_course(db, course_id, user)
    query = q.strip()
    vector = embed_query(query)
    return SearchOut(
        query=query,
        faq=[
            FaqHitOut(
                id=h.item.id,
                category=h.item.category,
                question=h.item.question,
                answer=h.item.answer,
                similarity=h.similarity,
            )
            for h in search_faq(db, course.id, vector)
        ],
        chunks=[
            ChunkHitOut(
                material_id=h.chunk.material_id,
                filename=h.filename,
                page=h.chunk.page,
                text=h.chunk.text,
                similarity=h.similarity,
            )
            for h in search_chunks(db, course.id, vector)
        ],
    )
