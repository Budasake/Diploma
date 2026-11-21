"""
The chat and its answer router. The LLM is replaced by a fake, so tests never call
Gemini; the fake also records whether it was called — the router's whole point is
that most questions should NOT reach it.
"""

import json

import pytest
from sqlalchemy import func, select

from app.ai.llm import LLMError, LLMStream
from app.ai.router import route_question
from app.ai.rules import GREETING
from app.core.db import SessionLocal
from app.models import CachedAnswer, Course, FaqItem, Message, Route
from tests.sample_files import make_docx, make_pdf

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
LECTURE = make_pdf(["Variables store values in memory", "Loops repeat a block of code"])
# With the fake embeddings, asking exactly a chunk's text finds that chunk (similarity 1).
ON_TOPIC = "Loops repeat a block of code"


class FakeLLM:
    def __init__(self):
        self.calls = 0
        self.answer = ["Давталт нь кодыг ", "давтан ажиллуулна [1]. ", "Зохиосон эх [9]."]
        self.error: LLMError | None = None

    def __call__(self, system, turns):
        self.calls += 1
        self.last_turns = turns
        if self.error:
            raise self.error
        return LLMStream(
            pieces=iter(self.answer), model="fake-model", prompt_tokens=100, output_tokens=20
        )


@pytest.fixture
def llm(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr("app.api.chat.stream_chat", fake)
    return fake


@pytest.fixture
def course(teacher):
    course = teacher.post("/api/courses", json={"title": "Программчлал"}).json()
    teacher.post(
        f"/api/courses/{course['id']}/materials",
        files={"file": ("lecture.pdf", LECTURE, "application/pdf")},
    )
    faq = make_docx(["Асуулт: Ирц хэдэн оноотой вэ?", "Хариулт: 6 оноо."])
    teacher.post(
        f"/api/courses/{course['id']}/faq/import", files={"file": ("faq.docx", faq, DOCX_MIME)}
    )
    return course


@pytest.fixture
def enrolled_student(student, course):
    assert student.post("/api/courses/join", json={"join_code": course["join_code"]}).is_success
    return student


def ask(client, course_id, message, conversation_id=None):
    """Send a chat message and collect the streamed events."""
    response = client.post(
        f"/api/courses/{course_id}/chat",
        json={"message": message, "conversation_id": conversation_id},
    )
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/event-stream")
    events = []
    for block in response.text.strip().split("\n\n"):
        if block.startswith(":"):
            continue  # heartbeat comment
        lines = dict(line.split(": ", 1) for line in block.split("\n"))
        events.append((lines["event"], json.loads(lines["data"])))
    names = [e for e, _ in events]
    assert names[0] == "meta" and names[1] == "route" and names[-1] == "done"
    return {
        "conversation_id": events[0][1]["conversation_id"],
        "route": events[1][1]["route"],
        "text": "".join(d["text"] for e, d in events if e == "delta"),
        "message": events[-1][1]["message"],
    }


def cache_size() -> int:
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(CachedAnswer))


# ---------- the five routes ----------


def test_greeting_is_answered_by_rules(enrolled_student, course, llm):
    result = ask(enrolled_student, course["id"], "Сайн байна уу!")

    assert result["route"] == "rule"
    assert result["text"] == GREETING
    assert llm.calls == 0


def test_faq_question_gets_the_teachers_answer(enrolled_student, course, llm):
    result = ask(enrolled_student, course["id"], "Ирц хэдэн оноотой вэ?")

    assert result["route"] == "faq"
    assert result["text"] == "6 оноо."
    assert llm.calls == 0


def test_question_outside_the_materials_is_not_found(enrolled_student, course, llm):
    result = ask(enrolled_student, course["id"], "Монголын нийслэл хаана вэ?")

    assert result["route"] == "not_found"
    assert "олдсонгүй" in result["text"]
    assert llm.calls == 0


def test_new_question_goes_to_the_llm_with_citations(enrolled_student, course, llm):
    result = ask(enrolled_student, course["id"], ON_TOPIC)

    assert result["route"] == "llm"
    assert llm.calls == 1
    # The passage was given to the LLM, numbered, with its file and page.
    assert "[1] (lecture.pdf, 2-р хуудас)" in llm.last_turns[-1].text
    # [9] pointed to no passage → removed; [1] → a real citation built by code.
    assert result["message"]["content"] == "Давталт нь кодыг давтан ажиллуулна [1]. Зохиосон эх ."
    assert result["message"]["citations"] == [
        {
            "n": 1,
            "material_id": result["message"]["citations"][0]["material_id"],
            "filename": "lecture.pdf",
            "page": 2,
        }
    ]


def test_llm_answer_is_logged(enrolled_student, course, llm):
    result = ask(enrolled_student, course["id"], ON_TOPIC)

    with SessionLocal() as db:
        message = db.get(Message, result["message"]["id"])
        assert message.route == Route.llm
        assert (message.llm_model, message.prompt_tokens, message.output_tokens) == (
            "fake-model",
            100,
            20,
        )
        assert message.latency_ms is not None
        assert message.score == pytest.approx(1.0)


def test_same_question_again_comes_from_the_cache(enrolled_student, course, llm):
    first = ask(enrolled_student, course["id"], ON_TOPIC)
    second = ask(enrolled_student, course["id"], ON_TOPIC)

    assert second["route"] == "cache"
    assert second["text"] == first["message"]["content"]
    assert second["message"]["citations"] == first["message"]["citations"]
    assert llm.calls == 1  # the LLM was called only once


def test_cache_is_ignored_after_the_materials_change(teacher, enrolled_student, course, llm):
    ask(enrolled_student, course["id"], ON_TOPIC)
    teacher.post(
        f"/api/courses/{course['id']}/materials",
        files={"file": ("new.pdf", make_pdf(["A brand new lecture page"]), "application/pdf")},
    )

    assert ask(enrolled_student, course["id"], ON_TOPIC)["route"] == "llm"
    assert llm.calls == 2


def test_follow_up_uses_history_and_is_not_cached(enrolled_student, course, llm, monkeypatch):
    # Fake embeddings can't see that "previous question + дэлгэрэнгүй" is on topic,
    # so let every passage through the gate for this test.
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "retrieval_threshold", -1.0)
    first = ask(enrolled_student, course["id"], ON_TOPIC)
    assert cache_size() == 1

    follow = ask(enrolled_student, course["id"], "дэлгэрэнгүй тайлбарла", first["conversation_id"])

    assert follow["route"] == "llm"
    assert [t.role for t in llm.last_turns] == ["user", "assistant", "user"]  # history sent
    assert cache_size() == 1  # depends on the earlier messages → not cached


def test_llm_failure_gives_a_friendly_message_and_is_not_cached(enrolled_student, course, llm):
    llm.error = LLMError("gemini 503: busy")

    result = ask(enrolled_student, course["id"], ON_TOPIC)

    # The stream announced "llm" before calling it; the saved message says what happened.
    assert result["message"]["route"] == "error"
    assert "дахин" in result["text"]
    assert cache_size() == 0


def test_llm_saying_not_found_is_not_cached(enrolled_student, course, llm):
    llm.answer = ["Энэ асуултын хариулт хичээлийн материалд олдсонгүй."]
    ask(enrolled_student, course["id"], ON_TOPIC)
    assert cache_size() == 0


# ---------- router details (no HTTP) ----------


def _course_with_faq(teacher, questions):
    course = teacher.post("/api/courses", json={"title": "Тест"}).json()
    lines = []
    for q, a in questions:
        lines += [f"Асуулт: {q}", f"Хариулт: {a}"]
    teacher.post(
        f"/api/courses/{course['id']}/faq/import",
        files={"file": ("faq.docx", make_docx(lines), DOCX_MIME)},
    )
    return course


def test_faq_numbers_must_match(teacher, monkeypatch):
    course = _course_with_faq(teacher, [("3-р лабораториор юу хийх вэ?", "Гурав")])
    # Pretend the embedding model sees "4-р …" as identical to "3-р …".
    monkeypatch.setattr("app.ai.router.embed_query", lambda text: _faq_vector(course["id"]))

    with SessionLocal() as db:
        answer = route_question(
            db, db.get(Course, course["id"]), "4-р лабораториор юу хийх вэ?", []
        )

    assert getattr(answer, "route", None) != Route.faq


def test_two_equally_close_faq_answers_are_both_shown(teacher, monkeypatch):
    course = _course_with_faq(
        teacher,
        [
            ("Явцын шалгалт хэзээ вэ?", "8-р долоо хоногт"),
            ("Эцсийн шалгалт хэзээ вэ?", "17-р долоо хоногт"),
        ],
    )
    monkeypatch.setattr("app.ai.router.embed_query", lambda text: _faq_vector(course["id"]))

    with SessionLocal() as db:
        answer = route_question(db, db.get(Course, course["id"]), "Шалгалт хэзээ вэ?", [])

    assert answer.route == Route.faq
    assert "8-р долоо хоногт" in answer.text and "17-р долоо хоногт" in answer.text


def test_follow_up_never_matches_the_faq(teacher, monkeypatch):
    from app.ai.llm import ChatTurn

    course = _course_with_faq(teacher, [("Пролог гэж юу вэ?", "Логик программчлалын хэл.")])
    monkeypatch.setattr("app.ai.router.embed_query", lambda text: _faq_vector(course["id"]))
    history = [
        ChatTurn("user", "2-р лабораториор юу хийх вэ?"),
        ChatTurn("assistant", "Дүрмийн бүтэц."),
    ]

    with SessionLocal() as db:
        answer = route_question(
            db, db.get(Course, course["id"]), "Дэлгэрэнгүй тайлбарлана уу", history
        )

    assert getattr(answer, "route", None) != Route.faq


def _faq_vector(course_id: int) -> list[float]:
    """Make every FAQ question of the course have the same vector, and return it."""
    vector = [1.0] + [0.0] * 383
    with SessionLocal() as db:
        for item in db.scalars(select(FaqItem).where(FaqItem.course_id == course_id)):
            item.embedding = vector
        db.commit()
    return vector


# ---------- conversations and permissions ----------


def test_messages_are_saved_in_a_conversation(enrolled_student, course, llm):
    first = ask(enrolled_student, course["id"], "Сайн байна уу")
    ask(enrolled_student, course["id"], "Ирц хэдэн оноотой вэ?", first["conversation_id"])

    conversations = enrolled_student.get(f"/api/courses/{course['id']}/conversations").json()
    assert [c["title"] for c in conversations] == ["Сайн байна уу"]
    detail = enrolled_student.get(
        f"/api/courses/{course['id']}/conversations/{first['conversation_id']}"
    ).json()
    assert [(m["role"], m["route"]) for m in detail["messages"]] == [
        ("user", None),
        ("assistant", "rule"),
        ("user", None),
        ("assistant", "faq"),
    ]


def test_others_cannot_see_or_continue_my_conversation(enrolled_student, course, make_user, llm):
    from tests.conftest import login_as

    mine = ask(enrolled_student, course["id"], "Сайн байна уу")
    make_user(email="classmate@example.com")
    classmate = login_as("classmate@example.com")
    classmate.post("/api/courses/join", json={"join_code": course["join_code"]})
    url = f"/api/courses/{course['id']}/conversations/{mine['conversation_id']}"

    assert classmate.get(url).status_code == 404
    response = classmate.post(
        f"/api/courses/{course['id']}/chat",
        json={"message": "hi", "conversation_id": mine["conversation_id"]},
    )
    assert response.status_code == 404


def test_outsider_cannot_chat(student, course, llm):
    response = student.post(f"/api/courses/{course['id']}/chat", json={"message": "hi"})
    assert response.status_code == 404


def test_teacher_can_try_the_chat(teacher, course, llm):
    assert ask(teacher, course["id"], "Ирц хэдэн оноотой вэ?")["route"] == "faq"


def test_delete_conversation(enrolled_student, course, llm):
    result = ask(enrolled_student, course["id"], "Сайн байна уу")
    url = f"/api/courses/{course['id']}/conversations/{result['conversation_id']}"

    assert enrolled_student.delete(url).status_code == 204
    assert enrolled_student.get(url).status_code == 404


def test_empty_message_is_rejected(enrolled_student, course, llm):
    response = enrolled_student.post(f"/api/courses/{course['id']}/chat", json={"message": "   "})
    assert response.status_code == 422


def test_answer_is_saved_even_if_the_student_leaves_mid_answer(enrolled_student, course, llm):
    from app.api.chat import _answer_stream

    first = ask(enrolled_student, course["id"], "Сайн байна уу")  # creates a conversation
    stream = _answer_stream(course["id"], first["conversation_id"], 0, ON_TOPIC, [])
    events = [next(stream) for _ in range(3)]  # meta, route, first piece of the answer
    assert "event: delta" in events[-1]
    stream.close()  # the browser tab was closed

    with SessionLocal() as db:
        last = db.scalars(select(Message).order_by(Message.id.desc())).first()
    assert last.route == Route.llm
    assert last.content == "Давталт нь кодыг "  # what had been written so far
    assert cache_size() == 0  # an incomplete answer is never cached


def test_slow_llm_gets_heartbeats_so_proxies_keep_the_connection(
    enrolled_student, course, llm, monkeypatch
):
    import time as _time

    def slow_pieces():
        _time.sleep(0.25)
        yield "Удаан хариулт [1]."

    llm.answer = slow_pieces()
    monkeypatch.setattr("app.api.chat.HEARTBEAT_SECONDS", 0.05)

    response = enrolled_student.post(
        f"/api/courses/{course['id']}/chat", json={"message": ON_TOPIC}
    )

    assert ": still thinking" in response.text
    assert "Удаан хариулт" in response.text
