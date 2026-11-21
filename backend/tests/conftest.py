"""
Shared test setup.

Tests use a separate database (`diploma_test`) so they never touch your real
data. Tables are created once per test run and emptied before every test.
"""

import os

# Must be set before the app is imported (the app reads settings on import).
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://localhost:5432/diploma_test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-1234567890")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

import app.models  # noqa: E402, F401  (registers tables)
from app.core.db import Base, SessionLocal, engine  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User, UserRole  # noqa: E402

PASSWORD = "correct-horse-battery"


@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _clean_tables():
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def make_user():
    """Create a user directly in the database: make_user(role=UserRole.teacher)."""

    def _make(
        email: str = "user@example.com",
        role: UserRole = UserRole.student,
        is_active: bool = True,
    ) -> User:
        with SessionLocal() as db:
            user = User(
                email=email,
                full_name="Test User",
                password_hash=hash_password(PASSWORD),
                role=role,
                is_active=is_active,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return user

    return _make
