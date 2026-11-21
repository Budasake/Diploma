"""Shapes of FAQ and search data sent to and from the API."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _strip(value: str | None) -> str | None:
    return value.strip() if isinstance(value, str) else value


class FaqOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: str | None
    question: str
    answer: str
    source: str
    position: int
    created_at: datetime
    updated_at: datetime


class FaqCreate(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
    answer: str = Field(min_length=1, max_length=5000)
    category: str | None = Field(default=None, max_length=200)

    @field_validator("question", "answer", "category", mode="before")
    @classmethod
    def strip(cls, value: str | None) -> str | None:
        return _strip(value) or None  # blank → None (a blank category is "no category")


class FaqUpdate(BaseModel):
    question: str | None = Field(default=None, min_length=3, max_length=1000)
    answer: str | None = Field(default=None, min_length=1, max_length=5000)
    category: str | None = Field(default=None, max_length=200)

    @field_validator("question", "answer", "category", mode="before")
    @classmethod
    def strip(cls, value: str | None) -> str | None:
        return _strip(value)  # "" stays "" → category "" means "remove the category"


class FaqImportResult(BaseModel):
    found: int  # pairs found in the file
    added: int
    updated: int  # same question, new answer or category
    unchanged: int


class FaqHitOut(BaseModel):
    id: int
    category: str | None
    question: str
    answer: str
    similarity: float


class ChunkHitOut(BaseModel):
    material_id: int
    filename: str
    page: int | None
    text: str
    similarity: float


class SearchOut(BaseModel):
    query: str
    faq: list[FaqHitOut]
    chunks: list[ChunkHitOut]
