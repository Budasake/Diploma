"""
Create a teacher or admin account from the terminal (students register on the website).

    uv run python -m app.scripts.create_user --role admin --email admin@example.com --name "Admin"

The password is asked for interactively, so it never appears in the shell history.
"""

import argparse
import getpass
import sys

from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import User, UserRole

MIN_PASSWORD = 8


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a user account.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True, help="Full name")
    parser.add_argument("--role", choices=[r.value for r in UserRole], default="teacher")
    args = parser.parse_args()

    email = args.email.strip().lower()
    password = getpass.getpass("Password: ")
    if len(password) < MIN_PASSWORD:
        print(f"Password must be at least {MIN_PASSWORD} characters.", file=sys.stderr)
        return 1
    if getpass.getpass("Repeat password: ") != password:
        print("Passwords don't match.", file=sys.stderr)
        return 1

    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.email == email)) is not None:
            print(f"A user with email {email} already exists.", file=sys.stderr)
            return 1
        user = User(
            email=email,
            full_name=args.name.strip(),
            password_hash=hash_password(password),
            role=UserRole(args.role),
        )
        db.add(user)
        db.commit()
        print(f"Created {user.role.value}: {user.email} (id {user.id})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
