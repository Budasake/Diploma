"""
What we send to the LLM (step 5) and how citations are built from its answer.

The LLM sees numbered passages: [1] (lab2.pdf, 3-р хуудас) … and is told to put
those numbers after the sentences that use them. Our code then turns each [n]
into a real citation (file + page) from the chunk's metadata. The LLM never
writes a file name or page itself, so it cannot invent a source; a number that
doesn't exist is simply dropped.
"""

import re
from dataclasses import dataclass

from app.ai.retrieval import ChunkHit

NOT_IN_MATERIALS = "Энэ асуултын хариулт хичээлийн материалд олдсонгүй."

SYSTEM_PROMPT = """Чи «{course}» хичээлийн AI туслах. Оюутны асуултад ЗӨВХӨН доор өгөгдсөн МАТЕРИАЛ дээр тулгуурлан хариул.

Дүрэм:
1. Материалд байхгүй мэдээллийг бүү зохио. Хариулт материалд байхгүй бол яг ингэж бич: «{not_found}»
2. Оюутны асуусан хэлээр хариул (ихэвчлэн монгол хэл). Англи материалыг монгол руу орчуулж тайлбарлаж болно.
3. Товч, ойлгомжтой бич: ихэвчлэн 2–6 өгүүлбэр. Шаардлагатай бол «- » эхэлсэн жагсаалт ашигла. Markdown гарчиг, хүснэгт, тод бичиг бүү ашигла.
4. Материалаас авсан өгүүлбэр бүрийн төгсгөлд эх сурвалжийн дугаарыг [1], [2] гэж бич. Файлын нэр, хуудас, URL өөрөө бүү бич — зөвхөн дугаар.
5. Хувийн мэдээлэл бүү асуу. Хичээлтэй холбоогүй асуултад хариулахгүй."""


@dataclass
class Source:
    n: int
    hit: ChunkHit


def system_prompt(course_title: str) -> str:
    return SYSTEM_PROMPT.format(course=course_title, not_found=NOT_IN_MATERIALS)


def build_question_turn(question: str, sources: list[Source]) -> str:
    """The last user turn: numbered passages, then the question."""
    blocks = []
    for s in sources:
        where = s.hit.filename + (f", {s.hit.chunk.page}-р хуудас" if s.hit.chunk.page else "")
        blocks.append(f"[{s.n}] ({where})\n{s.hit.chunk.text}")
    return "МАТЕРИАЛ:\n\n" + "\n\n".join(blocks) + f"\n\nАСУУЛТ: {question}"


_MARKER = re.compile(r"\[(\d{1,2})(?:\s*,\s*(\d{1,2}))*\]")


def extract_citations(answer: str, sources: list[Source]) -> list[dict]:
    """Citations for every valid [n] the answer used, in order of first use."""
    by_n = {s.n: s for s in sources}
    used: list[int] = []
    for match in _MARKER.finditer(answer):
        for number in re.findall(r"\d+", match.group(0)):
            n = int(number)
            if n in by_n and n not in used:
                used.append(n)
    return [
        {
            "n": n,
            "material_id": by_n[n].hit.chunk.material_id,
            "filename": by_n[n].hit.filename,
            "page": by_n[n].hit.chunk.page,
        }
        for n in used
    ]


def strip_invalid_markers(answer: str, sources: list[Source]) -> str:
    """Remove [n] markers that point to no passage (the LLM made them up)."""
    valid = {s.n for s in sources}

    def keep(match: re.Match[str]) -> str:
        numbers = [int(x) for x in re.findall(r"\d+", match.group(0))]
        good = [str(n) for n in numbers if n in valid]
        return f"[{', '.join(good)}]" if good else ""

    return _MARKER.sub(keep, answer)


def says_not_found(answer: str) -> bool:
    return NOT_IN_MATERIALS.rstrip(".") in answer
