import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import DeleteCourseButton from "@/components/courses/DeleteCourseButton";
import JoinCodeCard from "@/components/courses/JoinCodeCard";
import StudentsTable from "@/components/courses/StudentsTable";
import DashboardShell, { DashboardSkeleton } from "@/components/dashboard/DashboardShell";
import { apiGet } from "@/lib/api-server";
import { requireRole } from "@/lib/auth";
import type { Course, Student } from "@/lib/types";

export const metadata: Metadata = { title: "Хичээл · AI Сургалтын Туслах" };

export default function TeacherCoursePage({ params }: PageProps<"/teacher/courses/[id]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <TeacherCourse params={params} />
    </Suspense>
  );
}

async function TeacherCourse({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("teacher");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const [courseRes, studentsRes] = await Promise.all([
    apiGet<Course>(`/api/courses/${id}`),
    apiGet<Student[]>(`/api/courses/${id}/students`),
  ]);
  if (!courseRes.ok) notFound();
  const course = courseRes.data;
  const students = studentsRes.ok ? studentsRes.data : [];

  return (
    <DashboardShell user={user}>
      <Link href="/teacher" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Миний хичээлүүд
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {course.code && <p className="font-mono text-sm text-muted">{course.code}</p>}
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{course.title}</h1>
          {course.description && <p className="mt-3 max-w-2xl text-muted">{course.description}</p>}
        </div>
        <DeleteCourseButton courseId={course.id} title={course.title} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-6">
          {course.join_code && <JoinCodeCard courseId={course.id} joinCode={course.join_code} />}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 font-medium">
              <FileText className="h-4 w-4 text-primary-soft-foreground" /> Материал
            </div>
            <p className="mt-2 text-sm text-muted">
              Лекц, лабораторийн PDF, DOCX файл оруулах хэсэг дараагийн шатанд нэмэгдэнэ.
            </p>
          </div>
        </div>

        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Оюутнууд <span className="text-muted">({students.length})</span>
          </h2>
          <StudentsTable courseId={course.id} students={students} />
        </section>
      </div>
    </DashboardShell>
  );
}
