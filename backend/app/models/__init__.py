"""All database tables. Import every model here so Alembic can see them."""

from app.models.chat import CachedAnswer, Conversation, Message, MessageRole, Route
from app.models.course import Course, Enrollment
from app.models.faq import FaqItem
from app.models.material import Chunk, Material, MaterialStatus
from app.models.user import User, UserRole

__all__ = [
    "CachedAnswer",
    "Conversation",
    "Message",
    "MessageRole",
    "Route",
    "Chunk",
    "Course",
    "Enrollment",
    "FaqItem",
    "Material",
    "MaterialStatus",
    "User",
    "UserRole",
]
