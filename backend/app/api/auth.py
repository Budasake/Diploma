"""
Register, log in, log out, and "who am I?".

The login token is stored in an httpOnly cookie: the browser sends it
automatically with every request, and JavaScript on the page can't read it
(which protects it from being stolen by malicious scripts).

Errors return short codes (e.g. "email_taken"); the frontend turns them into
Mongolian messages.
"""

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User, UserRole
from app.schemas.auth import LoginRequest, RegisterRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

# Used to spend the same time on unknown emails as on wrong passwords, so an
# attacker can't tell from the response time which emails are registered.
_DUMMY_HASH = hash_password("timing-equalizer-password")


def _set_login_cookie(response: Response, user: User) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=create_access_token(user.id, user.role.value),
        max_age=settings.access_token_minutes * 60,
        httponly=True,  # not readable from JavaScript
        samesite="lax",  # not sent with cross-site form posts (CSRF protection)
        secure=settings.is_production,  # HTTPS-only in production
        path="/",
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, response: Response, db: DbSession) -> User:
    """Create a student account and log in. Teachers/admins are created by an admin."""
    if db.scalar(select(User.id).where(User.email == data.email)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="email_taken")

    user = User(
        email=data.email,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        role=UserRole.student,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # same email registered at the same moment
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail="email_taken") from None
    db.refresh(user)

    _set_login_cookie(response, user)
    return user


@router.post("/login", response_model=UserOut)
def login(data: LoginRequest, response: Response, db: DbSession) -> User:
    user = db.scalar(select(User).where(User.email == data.email))

    password_ok = verify_password(data.password, user.password_hash if user else _DUMMY_HASH)
    if user is None or not password_ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="inactive_user")

    _set_login_cookie(response, user)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(get_settings().auth_cookie_name, path="/")


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user
