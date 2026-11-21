"""All database tables. Import every model here so Alembic can see them."""

from app.models.course import Course, Enrollment
from app.models.user import User, UserRole

__all__ = ["Course", "Enrollment", "User", "UserRole"]
