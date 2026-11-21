"""
Course materials: teachers upload PDF/DOCX files; the server turns them into
searchable chunks in the background (see app/ingest/pipeline.py).

Who can do what:
- Teacher of the course (or admin): upload, list all, open, delete, reprocess.
- Enrolled student: list and open materials that are ready.
- Anyone else: 404, as with courses.
"""

import hashlib
import secrets
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.api.courses import can_manage, get_managed_course, get_visible_course
from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.ingest.pipeline import process_material, stored_path
from app.models import Chunk, Course, Material, MaterialStatus, User
from app.schemas.material import ChunkOut, MaterialOut

router = APIRouter(prefix="/courses/{course_id}/materials", tags=["materials"])

# Extension → (first bytes every such file starts with, content type for downloads).
# Checking the first bytes stops e.g. a renamed .exe from being accepted as a PDF.
_FILE_TYPES = {
    "pdf": (b"%PDF-", "application/pdf"),
    "docx": (
        b"PK\x03\x04",  # DOCX is a ZIP archive
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
}
_READ_BLOCK = 1024 * 1024  # copy uploads 1 MB at a time


def _get_material(db: DbSession, course: Course, material_id: int, user: User) -> Material:
    material = db.get(Material, material_id)
    if material is None or material.course_id != course.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="material_not_found")
    # Students only see files the AI can already use.
    if not can_manage(user, course) and material.status != MaterialStatus.ready:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="material_not_found")
    return material


@router.get("", response_model=list[MaterialOut])
def list_materials(course_id: int, user: CurrentUser, db: DbSession) -> list[Material]:
    course = get_visible_course(db, course_id, user)
    query = select(Material).where(Material.course_id == course.id).order_by(Material.created_at)
    if not can_manage(user, course):
        query = query.where(Material.status == MaterialStatus.ready)
    return list(db.scalars(query))


@router.post("", response_model=MaterialOut, status_code=status.HTTP_202_ACCEPTED)
def upload_material(
    course_id: int,
    file: Annotated[UploadFile, File()],
    background: BackgroundTasks,
    user: CurrentUser,
    db: DbSession,
) -> Material:
    """Save the file, answer right away (202 = accepted), and process it in the background."""
    course = get_managed_course(db, course_id, user)
    settings = get_settings()

    filename = (file.filename or "file").replace("\\", "/").split("/")[-1][:255]
    file_type = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if file_type not in _FILE_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="unsupported_file_type")
    magic, _ = _FILE_TYPES[file_type]

    # Copy to disk block by block (never the whole file in memory), hashing and
    # counting as we go, and give up as soon as it is too big.
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{secrets.token_hex(16)}.{file_type}"
    path = settings.upload_dir / stored_name
    max_bytes = settings.max_upload_mb * 1024 * 1024
    sha, size, first = hashlib.sha256(), 0, b""
    try:
        with path.open("wb") as out:
            while block := file.file.read(_READ_BLOCK):
                if not first:
                    first = block[: len(magic)]
                size += len(block)
                if size > max_bytes:
                    raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, detail="file_too_large")
                sha.update(block)
                out.write(block)
        if size == 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="empty_file")
        if first != magic:
            raise HTTPException(
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="unsupported_file_type"
            )
        content_hash = sha.hexdigest()
        duplicate = db.scalar(
            select(Material.id).where(
                Material.course_id == course.id, Material.content_hash == content_hash
            )
        )
        if duplicate is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="duplicate_material")
    except BaseException:
        path.unlink(missing_ok=True)  # don't leave half-saved or rejected files behind
        raise

    material = Material(
        course_id=course.id,
        uploaded_by_id=user.id,
        filename=filename,
        stored_name=stored_name,
        file_type=file_type,
        size_bytes=size,
        content_hash=content_hash,
        status=MaterialStatus.processing,
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    background.add_task(process_material, material.id)
    return material


@router.get("/{material_id}", response_model=MaterialOut)
def get_material(course_id: int, material_id: int, user: CurrentUser, db: DbSession) -> Material:
    course = get_visible_course(db, course_id, user)
    return _get_material(db, course, material_id, user)


@router.get("/{material_id}/chunks", response_model=list[ChunkOut])
def list_material_chunks(
    course_id: int,
    material_id: int,
    user: CurrentUser,
    db: DbSession,
    page: Annotated[int | None, Query(ge=1)] = None,
) -> list[Chunk]:
    """What the AI read from this file (optionally one page) — for the teacher to check."""
    course = get_managed_course(db, course_id, user)
    material = _get_material(db, course, material_id, user)
    query = select(Chunk).where(Chunk.material_id == material.id).order_by(Chunk.position)
    if page is not None:
        query = query.where(Chunk.page == page)
    return list(db.scalars(query))


@router.get("/{material_id}/file")
def open_material_file(
    course_id: int, material_id: int, user: CurrentUser, db: DbSession
) -> FileResponse:
    """The original file. PDFs open in the browser; `#page=N` jumps to a page."""
    course = get_visible_course(db, course_id, user)
    material = _get_material(db, course, material_id, user)
    path = stored_path(material)
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="material_not_found")
    return FileResponse(
        path,
        media_type=_FILE_TYPES[material.file_type][1],
        filename=material.filename,
        content_disposition_type="inline" if material.file_type == "pdf" else "attachment",
    )


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(course_id: int, material_id: int, user: CurrentUser, db: DbSession) -> Response:
    course = get_managed_course(db, course_id, user)
    material = _get_material(db, course, material_id, user)
    path = stored_path(material)
    db.delete(material)  # its chunks are deleted too (ON DELETE CASCADE)
    db.commit()
    path.unlink(missing_ok=True)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{material_id}/reprocess", response_model=MaterialOut, status_code=202)
def reprocess_material(
    course_id: int,
    material_id: int,
    background: BackgroundTasks,
    user: CurrentUser,
    db: DbSession,
) -> Material:
    """Run ingestion again, e.g. after a failure or when chunking settings changed."""
    course = get_managed_course(db, course_id, user)
    material = _get_material(db, course, material_id, user)
    if material.status == MaterialStatus.processing:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="material_processing")
    material.status = MaterialStatus.processing
    material.error = None
    db.commit()
    db.refresh(material)
    background.add_task(process_material, material.id)
    return material
