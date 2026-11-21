"""Health check: tells you whether the API and the database are working."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.db import get_db

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    db: Literal["ok", "error"]


@router.get("/health", response_model=HealthResponse)
def health(response: Response, db: Annotated[Session, Depends(get_db)]) -> HealthResponse:
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        # 503 = "service unavailable": the API runs but can't reach the database.
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(status="degraded", db="error")
    return HealthResponse(status="ok", db="ok")
