from fastapi import APIRouter, Depends

from app.api.deps import require_role
from app.main import app
from app.models import UserRole
from tests.conftest import PASSWORD

COOKIE = "access_token"


def register(client, email="new@example.com", password="password123", name="Бат Болд"):
    return client.post(
        "/api/auth/register", json={"email": email, "password": password, "full_name": name}
    )


# ---------- register ----------


def test_register_creates_student_and_logs_in(client):
    response = register(client, email="New@Example.com")

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "new@example.com"  # stored lowercase
    assert body["role"] == "student"
    assert body["full_name"] == "Бат Болд"
    assert "password" not in str(body)  # never leak the password or its hash
    assert COOKIE in response.cookies


def test_register_rejects_duplicate_email(client):
    register(client)
    response = register(client)

    assert response.status_code == 409
    assert response.json()["detail"] == "email_taken"


def test_register_rejects_short_password(client):
    response = register(client, password="short")

    assert response.status_code == 422


def test_register_cannot_choose_role(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "sneaky@example.com",
            "password": "password123",
            "full_name": "Sneaky",
            "role": "admin",
        },
    )

    assert response.status_code == 201
    assert response.json()["role"] == "student"


# ---------- login ----------


def test_login_success_sets_cookie(client, make_user):
    make_user(email="teacher@example.com", role=UserRole.teacher)

    response = client.post(
        "/api/auth/login", json={"email": "Teacher@example.com", "password": PASSWORD}
    )

    assert response.status_code == 200
    assert response.json()["role"] == "teacher"
    assert COOKIE in response.cookies


def test_login_wrong_password(client, make_user):
    make_user()

    response = client.post(
        "/api/auth/login", json={"email": "user@example.com", "password": "wrong-password"}
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "invalid_credentials"


def test_login_unknown_email_gives_same_error(client):
    response = client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": PASSWORD}
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "invalid_credentials"


def test_login_inactive_user(client, make_user):
    make_user(is_active=False)

    response = client.post(
        "/api/auth/login", json={"email": "user@example.com", "password": PASSWORD}
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "inactive_user"


# ---------- me / logout ----------


def test_me_requires_login(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_me_with_cookie(client):
    register(client)  # the test client keeps the cookie, like a browser

    response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json()["email"] == "new@example.com"


def test_me_rejects_forged_token(client):
    client.cookies.set(COOKIE, "not-a-real-token")

    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_logout_clears_cookie(client):
    register(client)

    response = client.post("/api/auth/logout")

    assert response.status_code == 204
    assert client.get("/api/auth/me").status_code == 401


# ---------- role guard ----------

_guarded = APIRouter()


@_guarded.get("/api/_test/teacher-only", dependencies=[Depends(require_role(UserRole.teacher))])
def _teacher_only():
    return {"ok": True}


app.include_router(_guarded)


def _login(client, email):
    client.post("/api/auth/login", json={"email": email, "password": PASSWORD})


def test_role_guard_blocks_student(client, make_user):
    make_user(email="student@example.com", role=UserRole.student)
    _login(client, "student@example.com")

    assert client.get("/api/_test/teacher-only").status_code == 403


def test_role_guard_allows_teacher(client, make_user):
    make_user(email="teacher@example.com", role=UserRole.teacher)
    _login(client, "teacher@example.com")

    assert client.get("/api/_test/teacher-only").status_code == 200
