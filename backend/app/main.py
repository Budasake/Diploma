"""
FastAPI application entry point.

Run in development (from the backend folder):
    uv run fastapi dev app/main.py
Interactive API docs: http://localhost:8000/docs
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, courses, faq, health, materials, search
from app.core.config import get_settings
from app.ingest.pipeline import fail_interrupted_jobs

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Background jobs don't survive a restart; mark unfinished ones as failed.
    fail_interrupted_jobs()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

# Let the Next.js frontend call this API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Every endpoint lives under /api (e.g. /api/health).
app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(courses.router, prefix="/api")
app.include_router(materials.router, prefix="/api")
app.include_router(faq.router, prefix="/api")
app.include_router(search.router, prefix="/api")
