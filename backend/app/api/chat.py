"""
The course chat.

POST /api/courses/{id}/chat answers with a *stream* (Server-Sent Events), so the
student sees the answer appear word by word instead of waiting for all of it:

    event: meta    data: {"conversation_id": 7, "user_message_id": 41}
    event: route   data: {"route": "llm"}                 ← which router step answers
    event: delta   data: {"text": "Хийсвэр машин нь "}    ← pieces of the answer
    event: delta   data: {"text": "…"}
    event: done    data: {"message": {...}}               ← saved message + citations

Who can chat: enrolled students, and the course's teacher/admin (to try it out).
Everyone only sees their own conversations.
"""

import json
import logging
import threading
import time
from collections.abc import Iterable, Iterator
from queue import Empty, Queue

from fastapi import APIRouter, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select

from app.ai.llm import ChatTurn, LLMError, stream_chat
from app.ai.prompt import extract_citations, says_not_found, strip_invalid_markers
from app.ai.router import LLMPlan, RoutedAnswer, route_question
from app.api.courses import get_visible_course
from app.api.deps import CurrentUser, DbSession
from app.core.db import SessionLocal
from app.models import (
    CachedAnswer,
    Conversation,
    Course,
    Message,
    MessageRole,
    Route,
    User,
)
from app.schemas.chat import ChatRequest, ConversationDetail, ConversationOut, MessageOut

log = logging.getLogger(__name__)

router = APIRouter(prefix="/courses/{course_id}", tags=["chat"])

LLM_FAILED_REPLY = (
    "Уучлаарай, AI туслах одоогоор хариулж чадсангүй (сервер завгүй байна). "
    "Түр хүлээгээд дахин асууна уу."
)
_HISTORY_MESSAGES = 4  # previous messages the LLM sees (2 questions + 2 answers)
HEARTBEAT_SECONDS = 5.0


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def _get_conversation(db: DbSession, course: Course, conversation_id: int, user: User):
    conversation = db.get(Conversation, conversation_id)
    if (
        conversation is None
        or conversation.course_id != course.id
        or conversation.user_id != user.id
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="conversation_not_found")
    return conversation


@router.post("/chat")
def chat(course_id: int, data: ChatRequest, user: CurrentUser, db: DbSession) -> StreamingResponse:
    course = get_visible_course(db, course_id, user)
    if not data.message:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail="empty_message")

    if data.conversation_id is not None:
        conversation = _get_conversation(db, course, data.conversation_id, user)
    else:
        conversation = Conversation(course_id=course.id, user_id=user.id, title=data.message[:120])
        db.add(conversation)
        db.flush()

    # History *before* this question, oldest first.
    previous = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.id.desc())
        .limit(_HISTORY_MESSAGES)
    ).all()
    history = [ChatTurn(m.role.value, m.content) for m in reversed(previous)]

    user_message = Message(
        conversation_id=conversation.id, role=MessageRole.user, content=data.message
    )
    db.add(user_message)
    conversation.updated_at = func.now()
    db.commit()

    stream = _answer_stream(course.id, conversation.id, user_message.id, data.message, history)
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        # no-transform: stops the Next.js server from gzip-compressing the stream —
        # compression holds the text back until the very end (seen in testing).
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


def _answer_stream(
    course_id: int, conversation_id: int, user_message_id: int, question: str, history
) -> Iterator[str]:
    """Runs after the response has started, with its own database session."""
    started = time.monotonic()
    yield _sse("meta", {"conversation_id": conversation_id, "user_message_id": user_message_id})

    with SessionLocal() as db:
        course = db.get(Course, course_id)
        message = Message(conversation_id=conversation_id, role=MessageRole.assistant, content="")
        finished = False
        try:
            try:
                plan = route_question(db, course, question, history)
            except Exception:
                log.exception("router failed")
                plan = RoutedAnswer(Route.error, LLM_FAILED_REPLY)

            if isinstance(plan, RoutedAnswer):
                message.route = plan.route
                message.content = plan.text
                message.citations = plan.citations
                message.faq_item_id = plan.faq_item_id
                message.score = plan.score
                yield _sse("route", {"route": plan.route.value})
                yield _sse("delta", {"text": plan.text})
            else:
                yield _sse("route", {"route": Route.llm.value})
                yield from _run_llm(db, course_id, plan, message)
            finished = True
        finally:
            # Save the answer even if the student closed the page mid-answer
            # (then the stream is cut, and the code after a `yield` never runs).
            if not finished:
                db.rollback()
            message.latency_ms = int((time.monotonic() - started) * 1000)
            db.add(message)
            conversation = db.get(Conversation, conversation_id)
            if conversation is not None:
                conversation.updated_at = func.now()
            db.commit()
            db.refresh(message)
        yield _sse("done", {"message": MessageOut.model_validate(message).model_dump(mode="json")})


def _with_heartbeat(pieces: Iterable[str]) -> Iterator[str | None]:
    """Read the LLM in a background thread; yield None every few seconds while it
    is silent, so the stream can send a heartbeat. Gemini sometimes needs >30 s
    before its first word, and proxies close connections that stay quiet that long."""
    queue: Queue = Queue()
    done = object()

    def produce() -> None:
        try:
            for piece in pieces:
                queue.put(piece)
        except BaseException as exc:  # handed over to the reading side
            queue.put(exc)
        finally:
            queue.put(done)

    threading.Thread(target=produce, daemon=True).start()
    while True:
        try:
            item = queue.get(timeout=HEARTBEAT_SECONDS)
        except Empty:
            yield None
            continue
        if item is done:
            return
        if isinstance(item, BaseException):
            raise item
        yield item


def _run_llm(db, course_id: int, plan: LLMPlan, message: Message) -> Iterator[str]:
    """Stream the LLM answer to the student, then build citations and maybe cache it."""
    parts: list[str] = []
    llm = None
    message.route = Route.llm
    message.score = plan.score
    try:
        llm = stream_chat(plan.system, plan.turns)
        for piece in _with_heartbeat(llm):
            if piece is None:
                yield ": still thinking\n\n"  # SSE comment: keeps proxies from closing
                continue
            parts.append(piece)
            message.content = "".join(parts)  # kept up to date in case the stream is cut
            yield _sse("delta", {"text": piece})
    except LLMError as exc:
        log.warning("LLM failed: %s", exc)
        if not parts:
            message.route = Route.error
            message.content = LLM_FAILED_REPLY
            yield _sse("delta", {"text": LLM_FAILED_REPLY})
            return
        # Part of the answer arrived: keep it, but don't cache an incomplete answer.
        plan.cacheable = False

    answer = strip_invalid_markers("".join(parts).strip(), plan.sources)
    message.route = Route.llm
    message.content = answer
    message.citations = extract_citations(answer, plan.sources)
    message.score = plan.score
    if llm is not None:
        message.llm_model = llm.model
        message.prompt_tokens = llm.prompt_tokens
        message.output_tokens = llm.output_tokens

    # Save for reuse — unless it's a follow-up (depends on earlier messages) or the
    # LLM itself said the materials don't contain the answer.
    if plan.cacheable and answer and not says_not_found(answer):
        db.add(
            CachedAnswer(
                course_id=course_id,
                materials_version=plan.materials_version,
                question=plan.question,
                embedding=plan.question_vector,
                answer=answer,
                citations=message.citations,
            )
        )


# ---------- conversation history ----------


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(course_id: int, user: CurrentUser, db: DbSession) -> list[Conversation]:
    course = get_visible_course(db, course_id, user)
    return list(
        db.scalars(
            select(Conversation)
            .where(Conversation.course_id == course.id, Conversation.user_id == user.id)
            .order_by(Conversation.updated_at.desc())
        )
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    course_id: int, conversation_id: int, user: CurrentUser, db: DbSession
) -> Conversation:
    course = get_visible_course(db, course_id, user)
    return _get_conversation(db, course, conversation_id, user)


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    course_id: int, conversation_id: int, user: CurrentUser, db: DbSession
) -> Response:
    course = get_visible_course(db, course_id, user)
    db.delete(_get_conversation(db, course, conversation_id, user))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
