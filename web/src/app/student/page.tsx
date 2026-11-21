import { Suspense } from "react";
import type { Metadata } from "next";
import CourseCard, { EmptyCourses } from "@/components/courses/CourseCard";
import JoinCourseForm from "@/components/courses/JoinCourseForm";
import DashboardShell, { DashboardSkeleton } from "@/components/dashboard/DashboardShell";
import { apiGet } from "@/lib/api-server";
import { requireRole } from "@/lib/auth";
import type { Course } from "@/lib/types";

export const metadata: Metadata = { title: "Оюутны самбар · AI Сургалтын Туслах" };

export default function StudentPage() {
  // Reading the login cookie happens at request time, so it streams in behind Suspense.
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <StudentDashboard />
    </Suspense>
  );
}

async function StudentDashboard() {
  const user = await requireRole("student");
  const result = await apiGet<Course[]>("/api/courses");
  const courses = result.ok ? result.data : [];
  const firstName = user.full_name.split(/\s+/).at(-1);

  return (
    <DashboardShell user={user}>
      <h1 className="text-3xl font-bold tracking-tight">Сайн байна уу, {firstName}! 👋</h1>
      <p className="mt-2 text-muted">Хичээлээ сонгоод AI туслахаас асуулт асуугаарай.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Миний хичээлүүд</h2>
          {!result.ok && <p className="mb-3 text-sm text-red-300">Хичээлүүдийг ачаалж чадсангүй.</p>}
          {courses.length === 0 ? (
            <EmptyCourses
              title="Та одоогоор хичээлд нэгдээгүй байна"
              text="Багшаасаа хичээлийн код аваад «Хичээлд нэгдэх» хэсэгт оруулна уу."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} href={`/student/courses/${course.id}`} forTeacher={false} />
              ))}
            </div>
          )}
        </section>
        <aside className="lg:pt-10">
          <JoinCourseForm />
        </aside>
      </div>
    </DashboardShell>
  );
}
