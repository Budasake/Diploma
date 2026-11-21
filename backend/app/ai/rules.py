"""
Step 1 of the answer router: small talk handled by simple rules — no AI at all.

Only messages that are *nothing but* a greeting / thanks / goodbye / "what can you
do?" are answered here. "Сайн байна уу, ирц хэдэн оноотой вэ?" contains a real
question, so it goes on to the next steps.
"""

import re

GREETING = "Сайн байна уу! 👋 Би энэ хичээлийн AI туслах. Багшийн оруулсан материалаас асуултад тань хариулна."
HELP = (
    "Би энэ хичээлийн багшийн оруулсан лекц, лаборатори, хөтөлбөр болон түгээмэл асуултаас хариулт "
    "хайж өгнө. Жишээ нь:\n"
    "- «Ирц хэдэн оноотой вэ?»\n"
    "- «Хийсвэр машин гэж юу вэ?»\n"
    "- «2-р лабораториор юу хийдэг вэ?»\n"
    "Хариулт бүрийн доор хаанаас авсныг (файл, хуудас) харуулна."
)
THANKS = "Зүгээр ээ! Өөр асуулт байвал асуугаарай. 🙂"
BYE = "Баяртай! Амжилт хүсье. 👋"
EMPTY = "Асуултаа бичнэ үү. Жишээ нь: «Хийсвэр машин гэж юу вэ?»"

_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        GREETING,
        re.compile(
            r"\b(сайн\s*(байна\s*)?(уу|байцгаана уу)|сайн уу|мэнд(ээ)?|hi|hello|hey|сн бну|снбну)\b"
        ),
    ),
    (
        THANKS,
        re.compile(
            r"\b(баярлалаа|баярлала|баярлаа|гайхалтай|ойлголоо|ойлгосон|thanks|thank you|thx|за за|за)\b"
        ),
    ),
    (BYE, re.compile(r"\b(баяртай|дараа уулзъя|bye|goodbye)\b")),
    (
        HELP,
        re.compile(
            r"\b(тусламж|help|чи юу (хийж|хийдэг|чаддаг|чадах)( вэ)?|юу асууж болох( вэ)?|"
            r"чи хэн бэ|чи юу вэ)\b"
        ),
    ),
]


def _normalize(text: str) -> str:
    text = text.lower().replace("ё", "е")
    text = re.sub(r"[^\w\s]", " ", text)  # drop punctuation and emoji
    return re.sub(r"\s+", " ", text).strip()


def match_rule(question: str) -> str | None:
    """The canned reply if the whole message is small talk, otherwise None."""
    text = _normalize(question)
    if not re.search(r"\w", text):
        return EMPTY
    for reply, pattern in _PATTERNS:
        rest = pattern.sub(" ", text)
        if rest != text and not rest.strip():
            return reply  # nothing left after removing the small-talk words
    return None
