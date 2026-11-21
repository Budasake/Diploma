"""
Courses and enrollment.

Who can do what:
- Teacher: create courses, see/edit/delete their own, see their students, remove a student.
- Student: join a course with its join code, see the courses they're in.
- Admin: see and manage every course.

Asking for a course you're not allowed to see returns 404 (not 403), so
outsiders can't even tell that the course exists.
"""

import secrets

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DbSession, require_role
from app.ingest.pipeline import stored_path
from app.models import Course, Enrollment, Material, User, UserRole
from app.schemas.course import CourseCreate, CourseOut, CourseUpdate, JoinRequest, StudentOut

router = APIRouter(prefix="/courses", tags=["courses"])

# No 0/O or 1/I/L, so codes are easy to read out loud and type.
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_CODE_LENGTH = 6


def _new_join_code(db: Session) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))
        if db.scalar(select(Course.id).where(Course.join_code == code)) is None:
            return code
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="join_code_failed")


def _student_counts(db: Session, course_ids: list[int]) -> dict[int, int]:
    if not course_ids:
        return {}
    rows = db.execute(
        select(Enrollment.course_id, func.count())
        .where(Enrollment.course_id.in_(course_ids))
        .group_by(Enrollment.course_id)
    )
    return dict(rows.all())


def can_manage(user: User, course: Course) -> bool:
    return user.role == UserRole.admin or course.teacher_id == user.id


def _to_out(course: Course, user: User, student_count: int) -> CourseOut:
    return CourseOut(
        id=course.id,
        title=course.title,
        code=course.code,
        description=course.description,
        teacher_name=course.teacher.full_name,
        student_count=student_count,
        created_at=course.created_at,
        join_code=course.join_code if can_manage(user, course) else None,
    )


def get_visible_course(db: Session, course_id: int, user: User) -> Course:
    """The course if this user may see it, otherwise 404."""
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="course_not_found")
    if can_manage(user, course):
        return course
    if user.role == UserRole.student:
        enrolled = db.scalar(
            select(Enrollment.id).where(
                Enrollment.course_id == course.id, Enrollment.student_id == user.id
            )
        )
        if enrolled is not None:
            return course
    raise HTTPException(status.HTTP_404_NOT_FOUND, detail="course_not_found")


def get_managed_course(db: Session, course_id: int, user: User) -> Course:
    """The course if this user is its teacher (or an admin), otherwise 404."""
    course = db.get(Course, course_id)
    if course is None or not can_manage(user, course):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="course_not_found")
    return course


# ---------- list / create / join ----------


@router.get("", response_model=list[CourseOut])
def list_courses(user: CurrentUser, db: DbSession) -> list[CourseOut]:
    query = select(Course).order_by(Course.created_at.desc())
    if user.role == UserRole.teacher:
        query = query.where(Course.teacher_id == user.id)
    elif user.role == UserRole.student:
        query = query.join(Enrollment).where(Enrollment.student_id == user.id)
    courses = list(db.scalars(query))
    counts = _student_counts(db, [c.id for c in courses])
    return [_to_out(c, user, counts.get(c.id, 0)) for c in courses]


@router.post(
    "",
    response_model=CourseOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.teacher))],
)
def create_course(data: CourseCreate, user: CurrentUser, db: DbSession) -> CourseOut:
    course = Course(**data.model_dump(), teacher_id=user.id, join_code=_new_join_code(db))
    db.add(course)
    db.commit()
    db.refresh(course)
    return _to_out(course, user, 0)


@router.post(
    "/join",
    response_model=CourseOut,
    dependencies=[Depends(require_role(UserRole.student))],
)
def join_course(data: JoinRequest, user: CurrentUser, db: DbSession) -> CourseOut:
    course = db.scalar(select(Course).where(Course.join_code == data.join_code))
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="invalid_join_code")

    db.add(Enrollment(course_id=course.id, student_id=user.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail="already_enrolled") from None
    return _to_out(course, user, _student_counts(db, [course.id]).get(course.id, 0))


# ---------- one course ----------


@router.get("/{course_id}", response_model=CourseOut)
def get_course(course_id: int, user: CurrentUser, db: DbSession) -> CourseOut:
    course = get_visible_course(db, course_id, user)
    return _to_out(course, user, _student_counts(db, [course.id]).get(course.id, 0))


@router.patch("/{course_id}", response_model=CourseOut)
def update_course(
    course_id: int, data: CourseUpdate, user: CurrentUser, db: DbSession
) -> CourseOut:
    course = get_managed_course(db, course_id, user)
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "title" and value is None:
            continue  # title can't be removed
        setattr(course, field, value)
    db.commit()
    db.refresh(course)
    return _to_out(course, user, _student_counts(db, [course.id]).get(course.id, 0))


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, user: CurrentUser, db: DbSession) -> Response:
    course = get_managed_course(db, course_id, user)
    # The database removes the course's materials and chunks (ON DELETE CASCADE);
    # the uploaded files on disk we remove ourselves.
    files = [
        stored_path(m) for m in db.scalars(select(Material).where(Material.course_id == course.id))
    ]
    db.delete(course)
    db.commit()
    for path in files:
        path.unlink(missing_ok=True)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{course_id}/join-code", response_model=CourseOut)
def regenerate_join_code(course_id: int, user: CurrentUser, db: DbSession) -> CourseOut:
    """New code (e.g. if the old one was shared too widely). Old code stops working."""
    course = get_managed_course(db, course_id, user)
    course.join_code = _new_join_code(db)
    db.commit()
    db.refresh(course)
    return _to_out(course, user, _student_counts(db, [course.id]).get(course.id, 0))


# ---------- students in a course ----------


@router.get("/{course_id}/students", response_model=list[StudentOut])
def list_students(course_id: int, user: CurrentUser, db: DbSession) -> list[StudentOut]:
    course = get_managed_course(db, course_id, user)
    rows = db.execute(
        select(User, Enrollment.created_at)
        .join(Enrollment, Enrollment.student_id == User.id)
        .where(Enrollment.course_id == course.id)
        .order_by(User.full_name)
    )
    return [
        StudentOut(id=u.id, full_name=u.full_name, email=u.email, joined_at=joined)
        for u, joined in rows
    ]


@router.delete("/{course_id}/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_student(course_id: int, student_id: int, user: CurrentUser, db: DbSession) -> Response:
    course = get_managed_course(db, course_id, user)
    enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.course_id == course.id, Enrollment.student_id == student_id
        )
    )
    if enrollment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="student_not_in_course")
    db.delete(enrollment)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
