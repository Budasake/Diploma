"""
Uploading course materials. In tests, FastAPI runs the background job before the
upload request returns, so the material is already processed when we check it.
"""

from pathlib import Path

import pytest
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import Chunk
from tests.sample_files import make_docx, make_pdf

PDF = make_pdf(["Variables store values in memory", "Loops repeat a block of code"])
DOCX = make_docx(["Хувьсагч нь санах ойд утга хадгалдаг нэр юм."])
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@pytest.fixture
def course(teacher):
    response = teacher.post("/api/courses", json={"title": "Программчлал"})
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def enrolled_student(student, course):
    assert student.post("/api/courses/join", json={"join_code": course["join_code"]}).is_success
    return student


def upload(client, course_id, name="lecture1.pdf", data=PDF, mime="application/pdf"):
    return client.post(f"/api/courses/{course_id}/materials", files={"file": (name, data, mime)})


def materials(client, course_id):
    response = client.get(f"/api/courses/{course_id}/materials")
    assert response.status_code == 200
    return response.json()


def count_chunks(material_id: int) -> int:
    with SessionLocal() as db:
        return db.scalar(select(func.count()).where(Chunk.material_id == material_id))


# ---------- upload + processing ----------


def test_teacher_uploads_pdf_and_it_becomes_ready(teacher, course):
    response = upload(teacher, course["id"])
    assert response.status_code == 202
    assert response.json()["status"] == "processing"

    [material] = materials(teacher, course["id"])
    assert material["filename"] == "lecture1.pdf"
    assert material["status"] == "ready"
    assert material["page_count"] == 2
    assert material["chunk_count"] == 2
    assert count_chunks(material["id"]) == 2


def test_chunks_remember_their_pdf_page(teacher, course):
    material_id = upload(teacher, course["id"]).json()["id"]

    with SessionLocal() as db:
        chunks = db.scalars(select(Chunk).where(Chunk.material_id == material_id)).all()

    assert [(c.page, c.text) for c in sorted(chunks, key=lambda c: c.position)] == [
        (1, "Variables store values in memory"),
        (2, "Loops repeat a block of code"),
    ]


def test_teacher_uploads_docx(teacher, course):
    assert upload(teacher, course["id"], "notes.docx", DOCX, DOCX_MIME).status_code == 202

    [material] = materials(teacher, course["id"])
    assert material["file_type"] == "docx"
    assert material["status"] == "ready"
    assert material["page_count"] is None


def test_pdf_without_text_is_marked_no_text(teacher, course):
    upload(teacher, course["id"], "scan.pdf", make_pdf(["", ""]))

    [material] = materials(teacher, course["id"])
    assert material["status"] == "no_text"
    assert material["chunk_count"] == 0


def test_broken_file_is_marked_failed(teacher, course):
    upload(teacher, course["id"], "broken.pdf", b"%PDF-1.4 this is not really a pdf")

    [material] = materials(teacher, course["id"])
    assert material["status"] == "failed"
    assert material["error"]


# ---------- rejected uploads ----------


def test_unsupported_extension_is_rejected(teacher, course):
    response = upload(teacher, course["id"], "slides.pptx", b"PK\x03\x04...", "application/zip")
    assert response.status_code == 415
    assert response.json()["detail"] == "unsupported_file_type"


def test_renamed_file_is_rejected_and_not_kept(teacher, course):
    files_before = set(Path(get_settings().upload_dir).iterdir())

    response = upload(teacher, course["id"], "virus.pdf", b"MZ\x90\x00not a pdf")

    assert response.status_code == 415
    assert set(Path(get_settings().upload_dir).iterdir()) == files_before
    assert materials(teacher, course["id"]) == []


def test_empty_file_is_rejected(teacher, course):
    assert upload(teacher, course["id"], data=b"").json()["detail"] == "empty_file"


def test_too_large_file_is_rejected(teacher, course, monkeypatch):
    monkeypatch.setattr(get_settings(), "max_upload_mb", 1)
    big = b"%PDF-" + b"0" * (1024 * 1024 + 10)

    response = upload(teacher, course["id"], data=big)

    assert response.status_code == 413
    assert response.json()["detail"] == "file_too_large"
    assert materials(teacher, course["id"]) == []


def test_same_file_twice_is_rejected(teacher, course):
    upload(teacher, course["id"])
    response = upload(teacher, course["id"], name="copy.pdf")
    assert response.status_code == 409
    assert response.json()["detail"] == "duplicate_material"


# ---------- permissions ----------


def test_student_cannot_upload(enrolled_student, course):
    assert upload(enrolled_student, course["id"]).status_code == 404


def test_other_teacher_cannot_upload_or_list(other_teacher, course):
    assert upload(other_teacher, course["id"]).status_code == 404
    assert other_teacher.get(f"/api/courses/{course['id']}/materials").status_code == 404


def test_admin_can_upload(admin, course):
    assert upload(admin, course["id"]).status_code == 202


def test_enrolled_student_sees_only_ready_materials(teacher, enrolled_student, course):
    upload(teacher, course["id"])  # ready
    upload(teacher, course["id"], "scan.pdf", make_pdf([""]))  # no_text

    assert [m["filename"] for m in materials(enrolled_student, course["id"])] == ["lecture1.pdf"]


def test_outsider_student_cannot_list(student, teacher, course):
    upload(teacher, course["id"])
    assert student.get(f"/api/courses/{course['id']}/materials").status_code == 404


# ---------- open file ----------


def test_enrolled_student_can_open_pdf(teacher, enrolled_student, course):
    material_id = upload(teacher, course["id"]).json()["id"]

    response = enrolled_student.get(f"/api/courses/{course['id']}/materials/{material_id}/file")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].startswith("inline")
    assert response.content == PDF


def test_student_cannot_open_material_that_is_not_ready(teacher, enrolled_student, course):
    material_id = upload(teacher, course["id"], "scan.pdf", make_pdf([""])).json()["id"]
    url = f"/api/courses/{course['id']}/materials/{material_id}/file"
    assert enrolled_student.get(url).status_code == 404


def test_material_from_another_course_is_not_found(teacher, course):
    material_id = upload(teacher, course["id"]).json()["id"]
    other = teacher.post("/api/courses", json={"title": "Өөр хичээл"}).json()

    url = f"/api/courses/{other['id']}/materials/{material_id}/file"
    assert teacher.get(url).status_code == 404


# ---------- delete / reprocess ----------


def test_delete_removes_row_chunks_and_file(teacher, course):
    material_id = upload(teacher, course["id"]).json()["id"]
    files_before = set(get_settings().upload_dir.iterdir())

    response = teacher.delete(f"/api/courses/{course['id']}/materials/{material_id}")

    assert response.status_code == 204
    assert materials(teacher, course["id"]) == []
    assert count_chunks(material_id) == 0
    assert len(set(get_settings().upload_dir.iterdir())) == len(files_before) - 1


def test_student_cannot_delete(teacher, enrolled_student, course):
    material_id = upload(teacher, course["id"]).json()["id"]
    url = f"/api/courses/{course['id']}/materials/{material_id}"
    assert enrolled_student.delete(url).status_code == 404


def test_deleting_course_removes_its_files(teacher, course):
    upload(teacher, course["id"])
    files_before = len(list(get_settings().upload_dir.iterdir()))

    assert teacher.delete(f"/api/courses/{course['id']}").status_code == 204

    assert len(list(get_settings().upload_dir.iterdir())) == files_before - 1


def test_reprocess_rebuilds_chunks(teacher, course):
    material_id = upload(teacher, course["id"]).json()["id"]

    response = teacher.post(f"/api/courses/{course['id']}/materials/{material_id}/reprocess")

    assert response.status_code == 202
    [material] = materials(teacher, course["id"])
    assert material["status"] == "ready"
    assert count_chunks(material_id) == 2  # replaced, not doubled


# ---------- one material / what the AI read ----------


def test_get_one_material(teacher, enrolled_student, course):
    material_id = upload(teacher, course["id"]).json()["id"]
    url = f"/api/courses/{course['id']}/materials/{material_id}"

    assert teacher.get(url).json()["filename"] == "lecture1.pdf"
    assert enrolled_student.get(url).json()["page_count"] == 2


def test_teacher_sees_chunks_of_one_page(teacher, course):
    material_id = upload(teacher, course["id"]).json()["id"]
    url = f"/api/courses/{course['id']}/materials/{material_id}/chunks"

    assert len(teacher.get(url).json()) == 2
    [chunk] = teacher.get(url, params={"page": 2}).json()
    assert chunk["text"] == "Loops repeat a block of code"


def test_student_cannot_see_chunks(teacher, enrolled_student, course):
    material_id = upload(teacher, course["id"]).json()["id"]
    url = f"/api/courses/{course['id']}/materials/{material_id}/chunks"
    assert enrolled_student.get(url).status_code == 404
