"""
Teacher FAQ: question–answer pairs the teacher has written and approved.

This is step 2 of the answer router (M3): if a student's question means the same
as an FAQ question, the teacher's own answer is returned — no LLM needed.
"""

from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.material import EMBEDDING_DIM


class FaqItem(Base):
    __tablename__ = "faq_items"
    __table_args__ = (
        Index(
            "ix_faq_items_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    # Section heading from the FAQ document, e.g. "Үнэлгээ" (optional).
    category: Mapped[str | None] = mapped_column(String(200))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    # Meaning of the *question* — compared with the student's question.
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM))
    source: Mapped[str] = mapped_column(String(20), default="manual")  # "import" or "manual"
    position: Mapped[int] = mapped_column(Integer, default=0)  # order shown in lists

    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
