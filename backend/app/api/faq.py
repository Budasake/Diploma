"""
Teacher FAQ for a course.

- Teacher of the course (or admin): import from a DOCX, add, edit, delete.
- Enrolled student: read the list (shown as "Түгээмэл асуулт").
- Anyone else: 404.

Every question is stored with its embedding, so the answer router (M3) can
match a student's question with the FAQ by meaning.
"""

import io
import re
import zipfile
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Response, UploadFile, status
from sqlalchemy import delete, func, select

from app.ai import embeddings
from app.api.courses import get_managed_course, get_visible_course
from app.api.deps import CurrentUser, DbSession
from app.ingest.faq import parse_faq_docx
from app.models import FaqItem
from app.schemas.faq import FaqCreate, FaqImportResult, FaqOut, FaqUpdate

router = APIRouter(prefix="/courses/{course_id}/faq", tags=["faq"])

_MAX_IMPORT_BYTES = 5 * 1024 * 1024  # an FAQ document is small


def _key(question: str) -> str:
    """Two questions are "the same" if they differ only in case and spacing."""
    return re.sub(r"\s+", " ", question).strip().casefold()


def _next_position(db: DbSession, course_id: int) -> int:
    current = db.scalar(select(func.max(FaqItem.position)).where(FaqItem.course_id == course_id))
    return (current or 0) + 1


def _get_item(db: DbSession, course_id: int, faq_id: int) -> FaqItem:
    item = db.get(FaqItem, faq_id)
    if item is None or item.course_id != course_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="faq_not_found")
    return item


@router.get("", response_model=list[FaqOut])
def list_faq(course_id: int, user: CurrentUser, db: DbSession) -> list[FaqItem]:
    course = get_visible_course(db, course_id, user)
    return list(
        db.scalars(
            select(FaqItem)
            .where(FaqItem.course_id == course.id)
            .order_by(FaqItem.position, FaqItem.id)
        )
    )


@router.post("", response_model=FaqOut, status_code=status.HTTP_201_CREATED)
def create_faq(course_id: int, data: FaqCreate, user: CurrentUser, db: DbSession) -> FaqItem:
    course = get_managed_course(db, course_id, user)
    item = FaqItem(
        course_id=course.id,
        category=data.category,
        question=data.question,
        answer=data.answer,
        embedding=embeddings.embed_texts([data.question])[0],
        source="manual",
        position=_next_position(db, course.id),
        created_by_id=user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{faq_id}", response_model=FaqOut)
def update_faq(
    course_id: int, faq_id: int, data: FaqUpdate, user: CurrentUser, db: DbSession
) -> FaqItem:
    course = get_managed_course(db, course_id, user)
    item = _get_item(db, course.id, faq_id)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("question"):
        if changes["question"] != item.question:
            item.embedding = embeddings.embed_texts([changes["question"]])[0]
        item.question = changes["question"]
    if changes.get("answer"):
        item.answer = changes["answer"]
    if "category" in changes:
        item.category = changes["category"] or None
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{faq_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_faq(course_id: int, faq_id: int, user: CurrentUser, db: DbSession) -> Response:
    course = get_managed_course(db, course_id, user)
    db.delete(_get_item(db, course.id, faq_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_all_faq(course_id: int, user: CurrentUser, db: DbSession) -> Response:
    course = get_managed_course(db, course_id, user)
    db.execute(delete(FaqItem).where(FaqItem.course_id == course.id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/import", response_model=FaqImportResult)
def import_faq(
    course_id: int,
    file: Annotated[UploadFile, File()],
    user: CurrentUser,
    db: DbSession,
) -> FaqImportResult:
    """Read "Асуулт: … / Хариулт: …" pairs from a DOCX.

    Importing the same file again is safe: known questions are updated if their
    answer changed, new ones are added, nothing is duplicated.
    """
    course = get_managed_course(db, course_id, user)
    name = (file.filename or "").lower()
    data = file.file.read(_MAX_IMPORT_BYTES + 1)
    if len(data) > _MAX_IMPORT_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, detail="file_too_large")
    if not name.endswith(".docx") or not data.startswith(b"PK\x03\x04"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="faq_docx_only")
    try:
        entries = parse_faq_docx(io.BytesIO(data))
    except (zipfile.BadZipFile, KeyError, ValueError):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, detail="invalid_faq_file"
        ) from None
    if not entries:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail="faq_empty")

    existing = {
        _key(item.question): item
        for item in db.scalars(select(FaqItem).where(FaqItem.course_id == course.id))
    }
    new_entries, updated, unchanged, seen = [], 0, 0, set()
    for entry in entries:
        key = _key(entry.question)
        if key in seen:
            continue  # the same question twice in one file: keep the first
        seen.add(key)
        if (item := existing.get(key)) is None:
            new_entries.append(entry)
        elif (item.answer, item.category) != (entry.answer, entry.category):
            item.answer, item.category = entry.answer, entry.category
            updated += 1
        else:
            unchanged += 1

    vectors = embeddings.embed_texts([e.question for e in new_entries])
    position = _next_position(db, course.id)
    db.add_all(
        FaqItem(
            course_id=course.id,
            category=entry.category,
            question=entry.question,
            answer=entry.answer,
            embedding=vector,
            source="import",
            position=position + i,
            created_by_id=user.id,
        )
        for i, (entry, vector) in enumerate(zip(new_entries, vectors, strict=True))
    )
    db.commit()
    return FaqImportResult(
        found=len(entries), added=len(new_entries), updated=updated, unchanged=unchanged
    )
