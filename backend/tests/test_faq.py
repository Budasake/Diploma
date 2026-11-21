"""Teacher FAQ: reading the DOCX format, importing, editing, permissions, and search."""

import pytest

from app.ingest.faq import Line, parse_faq_lines
from tests.sample_files import make_docx, make_pdf

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

FAQ_DOCX = make_docx(
    [
        "Асуулт: Ирц хэдэн оноотой вэ?",
        "Хариулт: 6",
        "Асуулт: Ямар ном ашиглах вэ?",
        "Хариулт:",
        "- Үндсэн сурах бичиг",
        "- Нэмэлт ном",
    ]
)


# ---------- the FAQ format (no database needed) ----------


def lines(*texts: str, heading: set[int] = frozenset(), lists: set[int] = frozenset()):
    return [Line(t, is_heading=i in heading, is_list=i in lists) for i, t in enumerate(texts)]


def test_pairs_and_categories_are_read():
    entries = parse_faq_lines(
        lines(
            "Үнэлгээ",
            "Асуулт: Ирц хэдэн оноотой вэ?",
            "Хариулт: 6",
            "Лаборатори",
            "Асуулт: Хэдэн лаборатори вэ?",
            "Хариулт: 8",
            heading={0, 3},
        )
    )

    assert [(e.category, e.question, e.answer) for e in entries] == [
        ("Үнэлгээ", "Ирц хэдэн оноотой вэ?", "6"),
        ("Лаборатори", "Хэдэн лаборатори вэ?", "8"),
    ]


def test_empty_answer_line_takes_the_following_lines():
    [entry] = parse_faq_lines(
        lines("Асуулт: Шаардлага юу вэ?", "Хариулт:", "Цаг баримтлах", "Идэвхтэй оролцох")
    )
    assert entry.answer == "Цаг баримтлах\nИдэвхтэй оролцох"


def test_list_items_continue_an_answer():
    [entry] = parse_faq_lines(
        lines(
            "Асуулт: Имэйл?",
            "Хариулт: a@must.edu.mn,",
            "b@must.edu.mn",  # Word bullet style
            "- c@must.edu.mn",  # dash
            lists={2},
        )
    )
    assert entry.answer == "a@must.edu.mn,\nb@must.edu.mn\n- c@must.edu.mn"


def test_unrelated_text_after_an_answer_is_not_glued_on():
    [entry] = parse_faq_lines(
        lines("Асуулт: Мэдээлэл байхгүй бол?", "Хариулт: Байхгүй гэж хэлнэ.", "Нийт оноо: 100")
    )
    assert entry.answer == "Байхгүй гэж хэлнэ."


def test_blank_line_ends_an_open_answer():
    [entry] = parse_faq_lines(lines("Асуулт: Ном?", "Хариулт:", "- Сурах бичиг", "", "Тэмдэглэл"))
    assert entry.answer == "- Сурах бичиг"


def test_question_without_answer_is_skipped():
    assert parse_faq_lines(
        lines("Асуулт: Хариултгүй асуулт?", "Асуулт: Энэ?", "Хариулт: Тийм")
    ) == [parse_faq_lines(lines("Асуулт: Энэ?", "Хариулт: Тийм"))[0]]


# ---------- import through the API ----------


@pytest.fixture
def course(teacher):
    response = teacher.post("/api/courses", json={"title": "Программчлал"})
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def enrolled_student(student, course):
    assert student.post("/api/courses/join", json={"join_code": course["join_code"]}).is_success
    return student


def import_faq(client, course_id, data=FAQ_DOCX, name="faq.docx"):
    return client.post(
        f"/api/courses/{course_id}/faq/import", files={"file": (name, data, DOCX_MIME)}
    )


def faq_list(client, course_id):
    response = client.get(f"/api/courses/{course_id}/faq")
    assert response.status_code == 200
    return response.json()


def test_teacher_imports_faq_docx(teacher, course):
    response = import_faq(teacher, course["id"])

    assert response.status_code == 200
    assert response.json() == {"found": 2, "added": 2, "updated": 0, "unchanged": 0}
    items = faq_list(teacher, course["id"])
    assert [i["question"] for i in items] == ["Ирц хэдэн оноотой вэ?", "Ямар ном ашиглах вэ?"]
    assert items[1]["answer"] == "- Үндсэн сурах бичиг\n- Нэмэлт ном"
    assert items[0]["source"] == "import"


def test_importing_again_does_not_duplicate_and_updates_changed_answers(teacher, course):
    import_faq(teacher, course["id"])
    changed = make_docx(
        ["Асуулт: ирц хэдэн  оноотой вэ?", "Хариулт: 10", "Асуулт: Шинэ асуулт?", "Хариулт: Тийм"]
    )

    response = import_faq(teacher, course["id"], changed)

    assert response.json() == {"found": 2, "added": 1, "updated": 1, "unchanged": 0}
    items = faq_list(teacher, course["id"])
    assert len(items) == 3
    assert items[0]["answer"] == "10"


def test_import_rejects_non_docx(teacher, course):
    response = import_faq(teacher, course["id"], make_pdf(["x"]), name="faq.pdf")
    assert response.status_code == 415
    assert response.json()["detail"] == "faq_docx_only"


def test_import_rejects_docx_without_pairs(teacher, course):
    response = import_faq(teacher, course["id"], make_docx(["Энд асуулт байхгүй."]))
    assert response.status_code == 422
    assert response.json()["detail"] == "faq_empty"


def test_import_rejects_broken_docx(teacher, course):
    response = import_faq(teacher, course["id"], b"PK\x03\x04 broken zip")
    assert response.status_code == 422
    assert response.json()["detail"] == "invalid_faq_file"


# ---------- add / edit / delete ----------


def test_teacher_adds_edits_and_deletes_faq(teacher, course):
    url = f"/api/courses/{course['id']}/faq"
    created = teacher.post(
        url, json={"question": "Шалгалт хэзээ вэ?", "answer": "17-р долоо хоногт"}
    )
    assert created.status_code == 201
    faq_id = created.json()["id"]

    edited = teacher.patch(f"{url}/{faq_id}", json={"answer": "16-р долоо хоногт", "category": ""})
    assert edited.status_code == 200
    assert edited.json()["answer"] == "16-р долоо хоногт"
    assert edited.json()["category"] is None

    assert teacher.delete(f"{url}/{faq_id}").status_code == 204
    assert faq_list(teacher, course["id"]) == []


def test_teacher_deletes_all_faq(teacher, course):
    import_faq(teacher, course["id"])
    assert teacher.delete(f"/api/courses/{course['id']}/faq").status_code == 204
    assert faq_list(teacher, course["id"]) == []


def test_blank_question_is_rejected(teacher, course):
    response = teacher.post(
        f"/api/courses/{course['id']}/faq", json={"question": "  ", "answer": "x"}
    )
    assert response.status_code == 422


# ---------- permissions ----------


def test_enrolled_student_reads_faq_but_cannot_change_it(teacher, enrolled_student, course):
    import_faq(teacher, course["id"])
    url = f"/api/courses/{course['id']}/faq"

    assert len(faq_list(enrolled_student, course["id"])) == 2
    assert import_faq(enrolled_student, course["id"]).status_code == 404
    assert (
        enrolled_student.post(url, json={"question": "Миний асуулт?", "answer": "x"}).status_code
        == 404
    )
    assert enrolled_student.delete(url).status_code == 404


def test_outsiders_cannot_see_faq(teacher, student, other_teacher, course):
    import_faq(teacher, course["id"])
    assert student.get(f"/api/courses/{course['id']}/faq").status_code == 404
    assert other_teacher.get(f"/api/courses/{course['id']}/faq").status_code == 404


def test_faq_item_of_another_course_is_not_found(teacher, course):
    import_faq(teacher, course["id"])
    faq_id = faq_list(teacher, course["id"])[0]["id"]
    other = teacher.post("/api/courses", json={"title": "Өөр хичээл"}).json()

    response = teacher.patch(f"/api/courses/{other['id']}/faq/{faq_id}", json={"answer": "x"})
    assert response.status_code == 404


# ---------- test search ----------


def test_search_finds_the_matching_faq_question(teacher, course):
    import_faq(teacher, course["id"])

    response = teacher.get(
        f"/api/courses/{course['id']}/search", params={"q": "Ирц хэдэн оноотой вэ?"}
    )

    assert response.status_code == 200
    best = response.json()["faq"][0]
    assert best["question"] == "Ирц хэдэн оноотой вэ?"
    assert best["answer"] == "6"
    assert best["similarity"] == pytest.approx(1.0)


def test_search_finds_material_chunks_with_page(teacher, course):
    pdf = make_pdf(["Variables store values in memory", "Loops repeat a block of code"])
    teacher.post(
        f"/api/courses/{course['id']}/materials",
        files={"file": ("lecture.pdf", pdf, "application/pdf")},
    )

    response = teacher.get(
        f"/api/courses/{course['id']}/search", params={"q": "Loops repeat a block of code"}
    )

    best = response.json()["chunks"][0]
    assert (best["filename"], best["page"]) == ("lecture.pdf", 2)
    assert best["similarity"] == pytest.approx(1.0)


def test_student_cannot_use_test_search(enrolled_student, course):
    url = f"/api/courses/{course['id']}/search"
    assert enrolled_student.get(url, params={"q": "Ирц"}).status_code == 404
