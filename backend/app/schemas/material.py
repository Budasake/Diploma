"""Shapes of course-material data sent by the API."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models import MaterialStatus


class MaterialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    filename: str
    file_type: str
    size_bytes: int
    status: MaterialStatus
    error: str | None
    page_count: int | None
    chunk_count: int
    created_at: datetime
    processed_at: datetime | None
