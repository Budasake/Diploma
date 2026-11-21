# Backend — FastAPI

API for the AI learning assistant. Python 3.12, managed with [uv](https://docs.astral.sh/uv/).

## First-time setup

```bash
cd backend
uv sync                     # install libraries into .venv
cp .env.example .env        # then fill in GEMINI_API_KEY etc.
uv run alembic upgrade head # create/update database tables
```

Requires PostgreSQL (Postgres.app) running with a `diploma` database, plus a
`diploma_test` database for tests (`createdb diploma_test`).

## Accounts

Students register on the website. Create teacher/admin accounts from the terminal
(the password is asked for, not typed on the command line):

```bash
uv run python -m app.scripts.create_user --role admin --email admin@example.com --name "Admin"
uv run python -m app.scripts.create_user --role teacher --email teacher@example.com --name "Г.Ганбат"
```

## Everyday commands

| Command | What it does |
|---|---|
| `uv run fastapi dev app/main.py` | Start the API with auto-reload on http://localhost:8000 |
| open http://localhost:8000/docs | Interactive API documentation |
| `uv run pytest` | Run tests |
| `uv run ruff check .` / `uv run ruff format .` | Lint / format code |
| `uv run alembic revision --autogenerate -m "message"` | Create a migration after changing models |
| `uv run alembic upgrade head` | Apply migrations |

## Structure

```
app/
  main.py         FastAPI app, CORS, routers
  core/config.py  settings from .env
  core/db.py      database engine, sessions, Base for models
  core/security.py password hashing (Argon2) and login tokens (JWT)
  models/         database tables (user.py)
  schemas/        request/response shapes (auth.py)
  api/            endpoints: health.py, auth.py (/api/auth/...), deps.py (login & role checks)
  scripts/        command-line tools (create_user.py)
alembic/          database migrations
tests/            pytest tests
```
