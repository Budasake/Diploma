"""
Course materials (files a teacher uploads) and their chunks (small pieces of text
with an embedding vector, used later to find the passages that answer a question).
"""

from datetime import datetime
from enum import StrEnum

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.user import User

# Size of one embedding vector. Must match the embedding model (see app/ai/embeddings.py).
EMBEDDING_DIM = 384


class MaterialStatus(StrEnum):
    processing = "processing"  # uploaded, being read/split/embedded in the background
    ready = "ready"  # chunks are in the database, the AI can use this file
    no_text = "no_text"  # file has no readable text (e.g. a scanned PDF without OCR)
    failed = "failed"  # something went wrong; see `error`


class Material(Base):
    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    uploaded_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    # Name shown to people (the original file name) and where the file is stored on disk.
    filename: Mapped[str] = mapped_column(String(255))
    stored_name: Mapped[str] = mapped_column(String(100), unique=True)
    file_type: Mapped[str] = mapped_column(String(10))  # "pdf" or "docx"
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    # SHA-256 of the file. Used to spot duplicate uploads and, later, to know when
    # cached answers built from an old version of the file must be thrown away.
    content_hash: Mapped[str] = mapped_column(String(64))

    status: Mapped[MaterialStatus] = mapped_column(
        Enum(
            MaterialStatus, name="material_status", values_callable=lambda e: [m.value for m in e]
        ),
        default=MaterialStatus.processing,
    )
    error: Mapped[str | None] = mapped_column(Text)
    page_count: Mapped[int | None] = mapped_column(Integer)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    uploaded_by: Mapped[User | None] = relationship()
    chunks: Mapped[list["Chunk"]] = relationship(
        back_populates="material", cascade="all, delete-orphan", passive_deletes=True
    )

    def __repr__(self) -> str:
        return f"<Material {self.id} {self.filename} {self.status}>"


class Chunk(Base):
    __tablename__ = "chunks"
    __table_args__ = (
        # HNSW index = fast "nearest vectors" search. vector_cosine_ops because we
        # compare meaning with cosine distance (the `<=>` operator in pgvector).
        Index(
            "ix_chunks_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    material_id: Mapped[int] = mapped_column(
        ForeignKey("materials.id", ondelete="CASCADE"), index=True
    )
    # Stored on the chunk too, so search can filter by course without a join.
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)  # 0, 1, 2 … order inside the file
    # Page number for PDFs (1-based) — this is what citations point to. None for DOCX.
    page: Mapped[int | None] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM))

    material: Mapped[Material] = relationship(back_populates="chunks")
