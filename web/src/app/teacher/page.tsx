import { Suspense } from "react";
import type { Metadata } from "next";
import CourseCard, { EmptyCourses } from "@/components/courses/CourseCard";
import CreateCourseForm from "@/components/courses/CreateCourseForm";
import DashboardShell, { DashboardSkeleton } from "@/components/dashboard/DashboardShell";
import { apiGet } from "@/lib/api-server";
import { requireRole } from "@/lib/auth";
import type { Course } from "@/lib/types";

export const metadata: Metadata = { title: "Багшийн самбар · AI Сургалтын Туслах" };

export default function TeacherPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <TeacherDashboard />
    </Suspense>
  );
}

async function TeacherDashboard() {
  const user = await requireRole("teacher");
  const result = await apiGet<Course[]>("/api/courses");
  const courses = result.ok ? result.data : [];

  return (
    <DashboardShell user={user}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Миний хичээлүүд</h1>
          <p className="mt-2 text-muted">Хичээл үүсгэж, кодыг нь оюутнууддаа илгээнэ.</p>
        </div>
        {courses.length > 0 && <CreateCourseForm />}
      </div>

      {!result.ok && <p className="mt-6 text-sm text-red-300">Хичээлүүдийг ачаалж чадсангүй.</p>}

      {courses.length === 0 ? (
        <div className="mt-8">
          <EmptyCourses title="Хичээл алга байна" text="Эхний хичээлээ үүсгээд оюутнуудаа урина уу.">
            <div className="mt-5 flex w-full justify-center">
              <CreateCourseForm />
            </div>
          </EmptyCourses>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} href={`/teacher/courses/${course.id}`} forTeacher />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
