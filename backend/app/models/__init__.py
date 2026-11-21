"""All database tables. Import every model here so Alembic can see them."""

from app.models.course import Course, Enrollment
from app.models.material import Chunk, Material, MaterialStatus
from app.models.user import User, UserRole

__all__ = ["Chunk", "Course", "Enrollment", "Material", "MaterialStatus", "User", "UserRole"]
