"""
Read a teacher's FAQ document (DOCX) into question–answer pairs.

Expected format (as in F_CSM101_QAQ.docx):

    Үнэлгээ                                ← heading → becomes the category
    Асуулт: Ирц хэдэн оноотой вэ?          ← starts a new question
    Хариулт: 6                             ← its answer
    Асуулт: Ямар ном ашиглах вэ?
    Хариулт:                               ← empty answer line …
    - Үндсэн сурах бичиг                   ← … so the following lines are the answer
    - Нэмэлт ном

Rules for lines after an answer:
- If "Хариулт:" was empty, every following line belongs to the answer.
- Otherwise only list items ("-", "•", "1.", Word bullet style) continue it.
- A blank line, a heading or the next "Асуулт:" ends the answer.
Any other text (e.g. notes outside Q/A pairs) is ignored, so it can't get glued
onto the previous answer by mistake.
"""

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import IO

from docx import Document

from app.ingest.parse import clean_text, decode_legacy_mongolian, looks_like_legacy_mongolian

_QUESTION = re.compile(r"^\s*(асуулт|question|q)\s*[:.)-]\s*", re.IGNORECASE)
_ANSWER = re.compile(r"^\s*(хариулт|answer|a)\s*[:.)-]\s*", re.IGNORECASE)
_LIST_ITEM = re.compile(r"^\s*([-•*–]|\d+[.)])\s*")


@dataclass
class FaqEntry:
    question: str
    answer: str
    category: str | None = None


@dataclass
class _Draft:
    question: str
    category: str | None
    answer_lines: list[str] = field(default_factory=list)
    answer_started: bool = False
    open_ended: bool = False  # "Хариулт:" was empty → take every following line
    closed: bool = False


@dataclass
class Line:
    text: str
    is_heading: bool = False
    is_list: bool = False  # Word list style (bullets/numbering)


def _squeeze(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def parse_faq_lines(lines: list[Line]) -> list[FaqEntry]:
    entries: list[FaqEntry] = []
    category: str | None = None
    draft: _Draft | None = None

    def finish() -> None:
        nonlocal draft
        if draft and draft.question and draft.answer_lines:
            answer = clean_text("\n".join(draft.answer_lines))
            if answer:
                entries.append(FaqEntry(draft.question, answer, draft.category))
        draft = None

    for line in lines:
        text = line.text.strip()
        if line.is_heading and text and not _QUESTION.match(text):
            finish()
            category = _squeeze(text)[:200]
            continue
        if not text:  # blank line ends the current answer
            if draft and draft.answer_started:
                draft.closed = True
            continue
        if m := _QUESTION.match(text):
            finish()
            draft = _Draft(question=_squeeze(text[m.end() :]), category=category)
            continue
        if draft is None:
            continue  # text outside any Q/A pair
        if m := _ANSWER.match(text):
            rest = text[m.end() :].strip()
            draft.answer_started = True
            draft.open_ended = not rest
            if rest:
                draft.answer_lines.append(rest)
            continue
        if not draft.answer_started:
            # A question written over two lines.
            draft.question = _squeeze(f"{draft.question} {text}")
            continue
        continues = not draft.closed and (
            draft.open_ended or line.is_list or bool(_LIST_ITEM.match(text))
        )
        if continues:
            draft.answer_lines.append(text)
        else:
            finish()  # unrelated text → this pair is complete; ignore the text

    finish()
    return entries


def parse_faq_docx(source: Path | IO[bytes]) -> list[FaqEntry]:
    doc = Document(str(source) if isinstance(source, Path) else source)
    lines: list[Line] = []
    for p in doc.paragraphs:
        style = (p.style.name if p.style is not None else "") or ""
        lines.append(
            Line(
                text=p.text,
                is_heading=style.startswith("Heading") or style == "Title",
                is_list=style.startswith("List") and style != "List Paragraph",
            )
        )
    # Same old-font fix as for course materials.
    if looks_like_legacy_mongolian(" ".join(line.text for line in lines)):
        for line in lines:
            line.text = decode_legacy_mongolian(line.text)
    return parse_faq_lines(lines)
