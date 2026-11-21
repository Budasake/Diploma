"""
Database connection (SQLAlchemy 2).

- `engine` keeps a pool of connections to PostgreSQL.
- `get_db()` gives each API request its own session and always closes it.
- `Base` is the parent class for all table models; Alembic reads
  `Base.metadata` to generate migrations.
"""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

engine = create_engine(get_settings().database_url, pool_pre_ping=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Parent class for all database tables."""


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
