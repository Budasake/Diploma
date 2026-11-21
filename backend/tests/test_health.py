from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.main import app

client = TestClient(app)


def test_health_ok_when_database_reachable():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok"}


def test_health_reports_database_error():
    class BrokenSession(Session):
        def execute(self, *args, **kwargs):
            raise RuntimeError("database is down")

    app.dependency_overrides[get_db] = lambda: BrokenSession()
    try:
        response = client.get("/api/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "db": "error"}
