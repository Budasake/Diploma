"""
Step 2 of ingestion: cut long text into small overlapping pieces ("chunks").

Why: when a student asks a question, we look for the few passages that answer it
and give only those to the AI. A whole lecture is too big and too vague; ~600
characters is about one short paragraph — specific enough to match a question.

Why overlap: if an answer sits on the border between two chunks, the overlap
makes sure at least one chunk contains it whole.

Chunks never cross a page border, so every chunk knows its exact page (for citations).
"""

from dataclasses import dataclass

from app.ingest.parse import Page

CHUNK_SIZE = 600  # characters
CHUNK_OVERLAP = 100  # characters shared with the previous chunk
MIN_CHUNK_CHARS = 20  # skip tiny leftovers like a lone page number

# Where we prefer to cut, best first: paragraph, line, sentence end, any space.
_BREAKS = ("\n\n", "\n", ". ", "? ", "! ", "; ", " ")


@dataclass
class TextChunk:
    page: int | None
    text: str


def _find_break(text: str, start: int, end: int) -> int:
    """Best place to cut text[start:end], searching only its last 40%."""
    window_start = start + int((end - start) * 0.6)
    for sep in _BREAKS:
        idx = text.rfind(sep, window_start, end)
        if idx != -1:
            return idx + len(sep)
    return end  # no good place: cut in the middle of a word


def split_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    text = text.strip()
    if len(text) <= size:
        return [text] if len(text) >= MIN_CHUNK_CHARS else []

    pieces: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            end = _find_break(text, start, end)
        piece = text[start:end].strip()
        if len(piece) >= MIN_CHUNK_CHARS:
            pieces.append(piece)
        if end >= len(text):
            break
        # Step back by `overlap`, then forward to the start of a word.
        next_start = max(end - overlap, start + 1)
        space = text.find(" ", next_start, end)
        start = space + 1 if space != -1 else next_start
    return pieces


def chunk_pages(pages: list[Page]) -> list[TextChunk]:
    return [TextChunk(page=p.number, text=piece) for p in pages for piece in split_text(p.text)]
