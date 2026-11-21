"""Shapes of course data sent to and from the API."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class _CourseFields(BaseModel):
    """Shared cleanup: trim spaces, and treat empty code/description as 'none'."""

    @field_validator("title", check_fields=False)
    @classmethod
    def strip_title(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value

    @field_validator("code", "description", check_fields=False)
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class CourseCreate(_CourseFields):
    title: str = Field(min_length=2, max_length=200)
    code: str | None = Field(default=None, max_length=30)
    description: str | None = Field(default=None, max_length=2000)


class CourseUpdate(_CourseFields):
    """Every field is optional: only the ones sent are changed."""

    title: str | None = Field(default=None, min_length=2, max_length=200)
    code: str | None = Field(default=None, max_length=30)
    description: str | None = Field(default=None, max_length=2000)


class CourseOut(BaseModel):
    id: int
    title: str
    code: str | None
    description: str | None
    teacher_name: str
    student_count: int
    created_at: datetime
    # Only the course's teacher (and admins) see the join code.
    join_code: str | None = None


class JoinRequest(BaseModel):
    join_code: str = Field(min_length=4, max_length=12)

    @field_validator("join_code")
    @classmethod
    def normalize(cls, value: str) -> str:
        return value.strip().upper()


class StudentOut(BaseModel):
    id: int
    full_name: str
    email: str
    joined_at: datetime
