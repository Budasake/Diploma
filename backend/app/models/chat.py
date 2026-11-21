"""
Chat: conversations, their messages, and the semantic answer cache.

Every assistant message records *which router step answered it* (`route`), how
long it took and — for LLM answers — the model and token counts. That log is
what the thesis evaluation measures (how many questions needed the LLM?).
"""

from datetime import datetime
from enum import StrEnum

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.material import EMBEDDING_DIM


class MessageRole(StrEnum):
    user = "user"
    assistant = "assistant"


class Route(StrEnum):
    """Which step of the answer router produced the answer."""

    rule = "rule"  # 1. intent rules (greeting, thanks, help) — no AI
    faq = "faq"  # 2. teacher's FAQ — no LLM
    cache = "cache"  # 3. same question answered before — no LLM
    not_found = "not_found"  # 4. nothing relevant in the materials — no LLM
    llm = "llm"  # 5. Gemini, grounded in the found passages
    error = "error"  # the LLM failed (quota, network …)


def _enum(cls: type[StrEnum], name: str) -> Enum:
    return Enum(cls, name=name, values_callable=lambda e: [m.value for m in e])


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Message.id",
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[MessageRole] = mapped_column(_enum(MessageRole, "message_role"))
    content: Mapped[str] = mapped_column(Text)

    # Assistant messages only:
    route: Mapped[Route | None] = mapped_column(_enum(Route, "answer_route"), index=True)
    # [{"n": 1, "material_id": 5, "filename": "lab2.pdf", "page": 3}, …] — built by code.
    citations: Mapped[list[dict] | None] = mapped_column(JSON)
    faq_item_id: Mapped[int | None] = mapped_column(ForeignKey("faq_items.id", ondelete="SET NULL"))
    score: Mapped[float | None] = mapped_column(Float)  # best similarity seen by the router
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    llm_model: Mapped[str | None] = mapped_column(String(60))
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class CachedAnswer(Base):
    """An LLM answer saved for reuse when a later question means the same thing.

    `materials_version` is a fingerprint of the course's ready files: when a file is
    added, changed or removed, the fingerprint changes and old answers stop matching.
    """

    __tablename__ = "answer_cache"
    __table_args__ = (
        Index(
            "ix_answer_cache_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    materials_version: Mapped[str] = mapped_column(String(64), index=True)
    question: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM))
    answer: Mapped[str] = mapped_column(Text)
    citations: Mapped[list[dict]] = mapped_column(JSON)
    hit_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_hit_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
