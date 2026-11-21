# Backend — FastAPI

API for the AI learning assistant. Python 3.12, managed with [uv](https://docs.astral.sh/uv/).

## First-time setup

```bash
cd backend
uv sync                     # install libraries into .venv
cp .env.example .env        # then fill in GEMINI_API_KEY etc.
uv run alembic upgrade head # create/update database tables
```

Requires PostgreSQL (Postgres.app) running with a `diploma` database.

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
  api/            endpoints (routers), e.g. health.py → GET /api/health
alembic/          database migrations
tests/            pytest tests
```
