"""Shapes of chat data sent to and from the API."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import MessageRole, Route


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: int | None = None

    @field_validator("message")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()


class Citation(BaseModel):
    n: int
    material_id: int
    filename: str
    page: int | None


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: MessageRole
    content: str
    route: Route | None
    citations: list[Citation] | None
    created_at: datetime


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]
