"""
Shared test setup.

Tests use a separate database (`diploma_test`) so they never touch your real
data. Tables are created once per test run and emptied before every test.
"""

import hashlib
import os
import shutil
import tempfile

# Must be set before the app is imported (the app reads settings on import).
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://localhost:5432/diploma_test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-1234567890")
# Uploaded files go to a throw-away folder, not backend/data/uploads.
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="diploma-test-uploads-")

import numpy as np  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

import app.models  # noqa: E402, F401  (registers tables)
from app.core.db import Base, SessionLocal, engine  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User, UserRole  # noqa: E402
from app.models.material import EMBEDDING_DIM  # noqa: E402

PASSWORD = "correct-horse-battery"


@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)
    shutil.rmtree(os.environ["UPLOAD_DIR"], ignore_errors=True)


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


@pytest.fixture(autouse=True)
def _fake_embeddings(request, monkeypatch):
    """Tests don't need the real 220 MB model: use fake vectors instead.
    The same text always gets the same vector, different texts get very different
    ones — enough to test search. Mark a test with @pytest.mark.real_embeddings
    to use the real model."""
    if "real_embeddings" in request.keywords:
        return

    def fake(texts: list[str]) -> list[list[float]]:
        vectors = []
        for item in texts:
            seed = int.from_bytes(hashlib.sha256(item.encode()).digest()[:8], "big")
            vectors.append(np.random.default_rng(seed).standard_normal(EMBEDDING_DIM).tolist())
        return vectors

    monkeypatch.setattr("app.ai.embeddings.embed_texts", fake)


def login_as(email: str) -> TestClient:
    """A separate client (own cookies) logged in as this user."""
    c = TestClient(app)
    assert c.post("/api/auth/login", json={"email": email, "password": PASSWORD}).status_code == 200
    return c


@pytest.fixture
def teacher(make_user):
    make_user(email="teacher@example.com", role=UserRole.teacher)
    return login_as("teacher@example.com")


@pytest.fixture
def other_teacher(make_user):
    make_user(email="other@example.com", role=UserRole.teacher)
    return login_as("other@example.com")


@pytest.fixture
def student(make_user):
    make_user(email="student@example.com", role=UserRole.student)
    return login_as("student@example.com")


@pytest.fixture
def admin(make_user):
    make_user(email="admin@example.com", role=UserRole.admin)
    return login_as("admin@example.com")
