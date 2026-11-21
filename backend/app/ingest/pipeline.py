"""
The whole ingestion job for one uploaded file. Runs in the background after the
upload request has already answered, so the teacher doesn't wait for it.

    file on disk --parse--> pages --chunk--> pieces --embed--> vectors --> `chunks` table

The material's `status` tells the UI where it is: processing → ready / no_text / failed.
"""

import logging
from datetime import UTC, datetime

from sqlalchemy import delete, update

from app.ai import embeddings
from app.core.config import get_settings
from app.core.db import SessionLocal
from app.ingest.chunking import chunk_pages
from app.ingest.parse import parse_file
from app.models import Chunk, Material, MaterialStatus

log = logging.getLogger(__name__)


def stored_path(material: Material):
    return get_settings().upload_dir / material.stored_name


def process_material(material_id: int) -> None:
    with SessionLocal() as db:
        material = db.get(Material, material_id)
        if material is None:  # deleted before we got to it
            return
        try:
            pages = parse_file(stored_path(material), material.file_type)
            pieces = chunk_pages(pages)
            vectors = embeddings.embed_texts([p.text for p in pieces])

            # Replace any chunks from an earlier run (reprocess).
            db.execute(delete(Chunk).where(Chunk.material_id == material.id))
            db.add_all(
                Chunk(
                    material_id=material.id,
                    course_id=material.course_id,
                    position=i,
                    page=piece.page,
                    text=piece.text,
                    embedding=vector,
                )
                for i, (piece, vector) in enumerate(zip(pieces, vectors, strict=True))
            )
            material.page_count = len(pages) if material.file_type == "pdf" else None
            material.chunk_count = len(pieces)
            material.status = MaterialStatus.ready if pieces else MaterialStatus.no_text
            material.error = None
            material.processed_at = datetime.now(UTC)
            db.commit()
            log.info("material %s: %s chunks", material.id, len(pieces))
        except Exception as exc:
            db.rollback()
            log.exception("material %s failed", material_id)
            # The row may be gone (deleted mid-way); updating 0 rows is fine.
            db.execute(
                update(Material)
                .where(Material.id == material_id)
                .values(
                    status=MaterialStatus.failed,
                    error=f"{type(exc).__name__}: {exc}"[:500],
                    processed_at=datetime.now(UTC),
                )
            )
            db.commit()


def fail_interrupted_jobs() -> None:
    """On server start: jobs that were 'processing' when the server stopped will
    never finish. Mark them failed so the teacher can press "reprocess"."""
    with SessionLocal() as db:
        db.execute(
            update(Material)
            .where(Material.status == MaterialStatus.processing)
            .values(status=MaterialStatus.failed, error="interrupted")
        )
        db.commit()
