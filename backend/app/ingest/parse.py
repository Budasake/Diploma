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


# ---------- old Mongolian fonts ----------
#
# Many older Mongolian documents were typed with fonts such as "Arial Mon" that draw
# Cyrillic letters but store them under Latin-1 codes. A PDF made from such a file
# gives text like "Çîðèëãî" instead of "Зорилго". The codes follow the Windows
# Cyrillic code page (cp1251), except a few Mongolian letters stored in odd places.
_LEGACY_EXTRA = {
    "³": "ү",  # ³
    "\u0093": "Ү",
    "°": "ө",  # °
    "\u0090": "Ө",
    "¼": "ё",  # ¼
    "\u0088": "•",  # bullet
}
_LEGACY_LETTERS = re.compile("[À-ÿ]")  # À … ÿ — where cp1251 keeps А … я
_CYRILLIC = re.compile("[Ѐ-ӿ]")
_LATIN = re.compile("[A-Za-z]")


def looks_like_legacy_mongolian(text: str) -> bool:
    """True when most letters are À…ÿ codes and there is almost no real Cyrillic.

    Real English has no such letters; French or German use a few per word at most,
    far below the 40% share that a garbled Mongolian text has.
    """
    legacy = len(_LEGACY_LETTERS.findall(text))
    if legacy < 20:
        return False
    cyrillic = len(_CYRILLIC.findall(text))
    latin = len(_LATIN.findall(text))
    return legacy > 4 * cyrillic and legacy > 0.4 * (legacy + latin)


def decode_legacy_mongolian(text: str) -> str:
    """Turn "Çîðèëãî" back into "Зорилго" (always converts — check first with
    looks_like_legacy_mongolian)."""
    out = []
    for ch in text:
        if ch in _LEGACY_EXTRA:
            out.append(_LEGACY_EXTRA[ch])
        elif "\u00c0" <= ch <= "\u00ff":
            out.append(bytes([ord(ch)]).decode("cp1251"))
        else:
            out.append(ch)
    return "".join(out)


def clean_text(text: str) -> str:
    """Tidy extracted text: drop odd characters, squeeze spaces, keep paragraph breaks."""
    text = text.replace("\x00", "").replace("­", "")  # null bytes, soft hyphens
    text = re.sub("[ \t ​]+", " ", text)  # spaces, tabs, non-breaking/zero-width spaces
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
        pages = parse_pdf(path)
    elif file_type == "docx":
        pages = parse_docx(path)
    else:
        raise ValueError(f"unsupported file type: {file_type}")

    # Decide for the whole document, so even a short page (e.g. only a title) is fixed.
    if looks_like_legacy_mongolian(" ".join(p.text for p in pages)):
        pages = [Page(p.number, decode_legacy_mongolian(p.text)) for p in pages]
    return pages
