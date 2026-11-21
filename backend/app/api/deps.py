"""
Reusable checks for endpoints ("dependencies").

    @router.get("/something")
    def something(user: CurrentUser): ...                      # any logged-in user

    @router.get("/teacher-only", dependencies=[Depends(require_role(UserRole.teacher))])
"""

from collections.abc import Callable
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import decode_access_token
from app.models import User, UserRole

DbSession = Annotated[Session, Depends(get_db)]

_COOKIE = get_settings().auth_cookie_name


def get_current_user(
    db: DbSession,
    token: Annotated[str | None, Cookie(alias=_COOKIE)] = None,
) -> User:
    """Read the login cookie, check the token, and load the user. 401 if anything fails."""
    not_authenticated = HTTPException(status.HTTP_401_UNAUTHORIZED, detail="not_authenticated")
    if not token:
        raise not_authenticated
    user_id = decode_access_token(token)
    if user_id is None:
        raise not_authenticated
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise not_authenticated
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: UserRole) -> Callable[[User], User]:
    """Only let users with one of these roles through (403 otherwise)."""

    def checker(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="forbidden")
        return user

    return checker
