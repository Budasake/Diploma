"""
Step 1 of ingestion: read the text out of a file.

The result is a list of pages, because citations later say "lecture3.pdf, page 12".
A DOCX file has no fixed pages (Word decides them when it draws the document),
so it comes back as a single "page" with number None.
"""

import re
from dataclasses import dataclass
from pathlib import Path

from docx import Document
from pypdf import PdfReader


@dataclass
class Page:
    number: int | None  # 1-based PDF page number; None for DOCX
    text: str


def clean_text(text: str) -> str:
    """Tidy extracted text: drop odd characters, squeeze spaces, keep paragraph breaks."""
    text = text.replace("\x00", "").replace("­", "")  # null bytes, soft hyphens
    text = re.sub(r"[ \t ​]+", " ", text)
    lines = [line.strip() for line in text.splitlines()]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)  # at most one empty line in a row
    return text.strip()


def parse_pdf(path: Path) -> list[Page]:
    reader = PdfReader(path)
    return [
        Page(number=i, text=clean_text(page.extract_text() or ""))
        for i, page in enumerate(reader.pages, start=1)
    ]


def parse_docx(path: Path) -> list[Page]:
    doc = Document(str(path))
    parts = [p.text for p in doc.paragraphs]
    # Tables are common in lecture handouts; read them row by row.
    for table in doc.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                parts.append(" | ".join(cells))
    return [Page(number=None, text=clean_text("\n".join(parts)))]


def parse_file(path: Path, file_type: str) -> list[Page]:
    if file_type == "pdf":
        return parse_pdf(path)
    if file_type == "docx":
        return parse_docx(path)
    raise ValueError(f"unsupported file type: {file_type}")
