import Link from "next/link";
import { ArrowRight, BookOpen, Users } from "lucide-react";
import type { Course } from "@/lib/types";

/** One course in a grid. Teachers see the student count and join code; students see the teacher. */
export default function CourseCard({ course, href, forTeacher }: { course: Course; href: string; forTeacher: boolean }) {
  return (
    <Link
      href={href}
      className="glass group flex flex-col rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white">
          <BookOpen className="h-5 w-5" />
        </span>
        {course.code && (
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 font-mono text-xs text-muted">{course.code}</span>
        )}
      </div>
      <h3 className="mt-4 font-semibold leading-snug">{course.title}</h3>
      <p className="mt-1 text-sm text-muted">
        {forTeacher ? (
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> {course.student_count} оюутан
          </span>
        ) : (
          course.teacher_name
        )}
      </p>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
        {forTeacher && course.join_code ? (
          <span className="text-muted">
            Код: <span className="font-mono font-semibold tracking-wider text-foreground">{course.join_code}</span>
          </span>
        ) : (
          <span className="text-muted">Хичээл рүү орох</span>
        )}
        <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
    </Link>
  );
}

export function EmptyCourses({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="glass flex flex-col items-center rounded-2xl px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
        <BookOpen className="h-6 w-6" />
      </span>
      <p className="mt-4 font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
      {children}
    </div>
  );
}
