"""
The answer router — the core idea of the thesis.

Every question tries the cheap steps first and stops at the first one that can
answer. The LLM is the *last* resort, not the default:

    1. rules       small talk ("сайн уу", "баярлалаа")            no AI at all
    2. faq         teacher's FAQ question means the same          teacher's own answer
    3. cache       the same question was answered before          saved LLM answer
    4. not_found   no passage in the materials is relevant        honest "not found"
    5. llm         Gemini, given only the best passages           grounded answer + citations

`route_question()` decides the route. For steps 1–4 the answer is ready at once;
for step 5 it returns an `LLMPlan` that the chat endpoint streams to the student.
"""

import hashlib
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.llm import ChatTurn
from app.ai.prompt import Source, build_question_turn, system_prompt
from app.ai.retrieval import embed_query, search_chunks, search_faq
from app.ai.rules import match_rule
from app.core.config import get_settings
from app.models import CachedAnswer, Course, Material, MaterialStatus, Route

NOT_FOUND_REPLY = (
    "Уучлаарай, энэ асуултын хариулт энэ хичээлийн материалд олдсонгүй. "
    "Асуултаа өөрөөр томъёолж үзэх эсвэл багшаасаа асуугаарай."
)

# Words that usually point back to the previous message ("explain *that* more").
_FOLLOW_UP = re.compile(
    r"\b(үүнийг|түүнийг|үүний|түүний|үүнд|түүнд|дээрх|өмнөх|дахиад|дэлгэрэнгүй|жишээ|"
    r"тэгвэл|it|that|more|example)\b",
    re.IGNORECASE,
)


@dataclass
class RoutedAnswer:
    """A finished answer from steps 1–4."""

    route: Route
    text: str
    citations: list[dict] = field(default_factory=list)
    faq_item_id: int | None = None
    score: float | None = None


@dataclass
class LLMPlan:
    """Everything step 5 needs: the prompt, the numbered sources, and cache info."""

    system: str
    turns: list[ChatTurn]
    sources: list[Source]
    score: float
    question: str
    question_vector: list[float]
    materials_version: str
    cacheable: bool


def materials_version(db: Session, course_id: int) -> str:
    """Fingerprint of the course's ready files. Changes when any file is added,
    replaced or removed — then old cached answers no longer match."""
    rows = db.execute(
        select(Material.id, Material.content_hash)
        .where(Material.course_id == course_id, Material.status == MaterialStatus.ready)
        .order_by(Material.id)
    ).all()
    return hashlib.sha256(",".join(f"{i}:{h}" for i, h in rows).encode()).hexdigest()


def _numbers(text: str) -> set[str]:
    return set(re.findall(r"\d+", text))


def is_follow_up(question: str, history: list[ChatTurn]) -> bool:
    """A question that only makes sense together with the previous messages."""
    if not history:
        return False
    return len(question.split()) <= 3 or bool(_FOLLOW_UP.search(question))


def route_question(
    db: Session, course: Course, question: str, history: list[ChatTurn]
) -> RoutedAnswer | LLMPlan:
    settings = get_settings()

    # 1. Rules: small talk.
    if (reply := match_rule(question)) is not None:
        return RoutedAnswer(Route.rule, reply)

    vector = embed_query(question)
    # A follow-up ("дэлгэрэнгүй тайлбарла") refers to the previous message, so it is
    # not a question on its own: it must not match the FAQ or the cache. (A short,
    # vague phrase can land close to an unrelated FAQ question — seen in testing:
    # «Дэлгэрэнгүй тайлбарлана уу» → «Пролог гэж юу вэ?» at 0.76.)
    follow_up = is_follow_up(question, history)

    # 2. Teacher FAQ.
    # Numbers must match: «3-р долоо хоног» and «4-р долоо хоног» look almost the same
    # to the embedding model, but they are different questions.
    asked_numbers = _numbers(question)
    faq = (
        []
        if follow_up
        else [
            hit
            for hit in search_faq(db, course.id, vector, limit=5)
            if _numbers(hit.item.question) == asked_numbers
        ][:2]
    )
    if faq and faq[0].similarity >= settings.faq_threshold:
        best = faq[0]
        text = best.item.answer
        # Two FAQ questions match almost equally (e.g. «шалгалт хэзээ» → midterm
        # or final?): show the second one too instead of guessing.
        if (
            len(faq) > 1
            and faq[1].similarity >= settings.faq_threshold
            and best.similarity - faq[1].similarity < 0.05
        ):
            text += (
                f"\n\nТа үүнийг асуусан байж магадгүй: «{faq[1].item.question}»\n"
                f"{faq[1].item.answer}"
            )
        return RoutedAnswer(Route.faq, text, faq_item_id=best.item.id, score=best.similarity)

    # 3. Semantic answer cache (same course, same version of the materials).
    version = materials_version(db, course.id)
    if not follow_up:
        distance = CachedAnswer.embedding.cosine_distance(vector)
        row = db.execute(
            select(CachedAnswer, distance)
            .where(CachedAnswer.course_id == course.id, CachedAnswer.materials_version == version)
            .order_by(distance)
            .limit(1)
        ).first()
        if row is not None:
            cached, d = row
            similarity = round(1 - float(d), 4)
            # Numbers must match: "3-р лаборатори" must not reuse the answer for "4-р".
            same_numbers = _numbers(cached.question) == asked_numbers
            if similarity >= settings.cache_threshold and same_numbers:
                cached.hit_count += 1
                cached.last_hit_at = datetime.now(UTC)
                db.commit()
                return RoutedAnswer(
                    Route.cache, cached.answer, citations=cached.citations, score=similarity
                )

    # 4. Retrieval gate: is anything in the materials relevant at all?
    # For a follow-up ("дэлгэрэнгүй тайлбарла"), search together with the previous
    # question so the topic being discussed is still found.
    previous = next((t.text for t in reversed(history) if t.role == "user"), "")
    search_vector = embed_query(f"{previous} {question}") if follow_up and previous else vector
    hits = search_chunks(db, course.id, search_vector, limit=settings.retrieval_top_k)
    best_score = hits[0].similarity if hits else 0.0
    if best_score < settings.retrieval_threshold:
        return RoutedAnswer(Route.not_found, NOT_FOUND_REPLY, score=best_score or None)

    # 5. LLM with the relevant passages only.
    relevant = [h for h in hits if h.similarity >= settings.retrieval_threshold]
    sources = [Source(n, hit) for n, hit in enumerate(relevant, start=1)]
    turns = history[-4:] + [ChatTurn("user", build_question_turn(question, sources))]
    return LLMPlan(
        system=system_prompt(course.title),
        turns=turns,
        sources=sources,
        score=best_score,
        question=question,
        question_vector=vector,
        materials_version=version,
        cacheable=not follow_up,
    )
