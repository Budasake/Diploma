def create_course(client, title="Программчлалын үндсэн аргууд", code="F.CSM101"):
    response = client.post("/api/courses", json={"title": title, "code": code})
    assert response.status_code == 201, response.text
    return response.json()


# ---------- create ----------


def test_teacher_creates_course_with_join_code(teacher):
    course = create_course(teacher)

    assert course["title"] == "Программчлалын үндсэн аргууд"
    assert course["code"] == "F.CSM101"
    assert course["student_count"] == 0
    assert len(course["join_code"]) == 6


def test_blank_code_becomes_none(teacher):
    course = create_course(teacher, code="   ")

    assert course["code"] is None


def test_student_cannot_create_course(student):
    response = student.post("/api/courses", json={"title": "Hack"})

    assert response.status_code == 403


# ---------- join ----------


def test_student_joins_with_code(teacher, student):
    course = create_course(teacher)

    response = student.post("/api/courses/join", json={"join_code": course["join_code"].lower()})

    assert response.status_code == 200
    assert response.json()["id"] == course["id"]
    assert response.json()["join_code"] is None  # students don't see the code
    assert response.json()["student_count"] == 1


def test_join_wrong_code(student):
    response = student.post("/api/courses/join", json={"join_code": "ZZZZZZ"})

    assert response.status_code == 404
    assert response.json()["detail"] == "invalid_join_code"


def test_join_twice(teacher, student):
    code = create_course(teacher)["join_code"]
    student.post("/api/courses/join", json={"join_code": code})

    response = student.post("/api/courses/join", json={"join_code": code})

    assert response.status_code == 409
    assert response.json()["detail"] == "already_enrolled"


def test_teacher_cannot_join(teacher, other_teacher):
    code = create_course(teacher)["join_code"]

    assert other_teacher.post("/api/courses/join", json={"join_code": code}).status_code == 403


# ---------- list / see ----------


def test_each_role_sees_the_right_courses(teacher, other_teacher, student, admin):
    mine = create_course(teacher, title="Mine")
    create_course(other_teacher, title="Not mine")
    student.post("/api/courses/join", json={"join_code": mine["join_code"]})

    assert [c["title"] for c in teacher.get("/api/courses").json()] == ["Mine"]
    assert [c["title"] for c in student.get("/api/courses").json()] == ["Mine"]
    assert len(admin.get("/api/courses").json()) == 2


def test_not_enrolled_student_gets_404(teacher, student):
    course = create_course(teacher)

    response = student.get(f"/api/courses/{course['id']}")

    assert response.status_code == 404


def test_other_teacher_gets_404(teacher, other_teacher):
    course = create_course(teacher)

    assert other_teacher.get(f"/api/courses/{course['id']}").status_code == 404
    assert other_teacher.delete(f"/api/courses/{course['id']}").status_code == 404


# ---------- manage ----------


def test_teacher_updates_course(teacher):
    course = create_course(teacher)

    response = teacher.patch(f"/api/courses/{course['id']}", json={"description": "Шинэ тайлбар"})

    assert response.status_code == 200
    assert response.json()["description"] == "Шинэ тайлбар"
    assert response.json()["title"] == course["title"]  # unchanged


def test_regenerate_code_invalidates_old_one(teacher, student):
    course = create_course(teacher)
    old = course["join_code"]

    new = teacher.post(f"/api/courses/{course['id']}/join-code").json()["join_code"]

    assert new != old
    assert student.post("/api/courses/join", json={"join_code": old}).status_code == 404
    assert student.post("/api/courses/join", json={"join_code": new}).status_code == 200


def test_teacher_sees_and_removes_students(teacher, student):
    course = create_course(teacher)
    student.post("/api/courses/join", json={"join_code": course["join_code"]})

    students = teacher.get(f"/api/courses/{course['id']}/students").json()
    assert [s["email"] for s in students] == ["student@example.com"]

    removed = teacher.delete(f"/api/courses/{course['id']}/students/{students[0]['id']}")
    assert removed.status_code == 204
    assert teacher.get(f"/api/courses/{course['id']}/students").json() == []
    assert student.get(f"/api/courses/{course['id']}").status_code == 404


def test_student_cannot_list_classmates(teacher, student):
    course = create_course(teacher)
    student.post("/api/courses/join", json={"join_code": course["join_code"]})

    assert student.get(f"/api/courses/{course['id']}/students").status_code == 404


def test_delete_course_removes_enrollments(teacher, student):
    course = create_course(teacher)
    student.post("/api/courses/join", json={"join_code": course["join_code"]})

    assert teacher.delete(f"/api/courses/{course['id']}").status_code == 204
    assert student.get("/api/courses").json() == []
