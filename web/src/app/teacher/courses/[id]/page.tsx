import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, HelpCircle, Search } from "lucide-react";
import DeleteCourseButton from "@/components/courses/DeleteCourseButton";
import JoinCodeCard from "@/components/courses/JoinCodeCard";
import StudentsTable from "@/components/courses/StudentsTable";
import MaterialsManager from "@/components/materials/MaterialsManager";
import DashboardShell, { DashboardSkeleton } from "@/components/dashboard/DashboardShell";
import { apiGet } from "@/lib/api-server";
import { requireRole } from "@/lib/auth";
import type { Course, FaqItem, Material, Student } from "@/lib/types";

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

  const [courseRes, studentsRes, materialsRes, faqRes] = await Promise.all([
    apiGet<Course>(`/api/courses/${id}`),
    apiGet<Student[]>(`/api/courses/${id}/students`),
    apiGet<Material[]>(`/api/courses/${id}/materials`),
    apiGet<FaqItem[]>(`/api/courses/${id}/faq`),
  ]);
  if (!courseRes.ok) notFound();
  const course = courseRes.data;
  const students = studentsRes.ok ? studentsRes.data : [];
  const materials = materialsRes.ok ? materialsRes.data : [];
  const faqCount = faqRes.ok ? faqRes.data.length : 0;

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

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section>
          <h2 className="mb-1 text-lg font-semibold">Материал</h2>
          <p className="mb-4 text-sm text-muted">
            AI туслах зөвхөн энд оруулсан файлуудаас хариулт хайна.
          </p>
          <MaterialsManager courseId={course.id} initialMaterials={materials} />
        </section>

        <div className="space-y-6">
          {course.join_code && <JoinCodeCard courseId={course.id} joinCode={course.join_code} />}
          <div className="glass divide-y divide-border overflow-hidden rounded-2xl">
            <NavRow
              href={`/teacher/courses/${course.id}/faq`}
              icon={<HelpCircle className="h-4 w-4" />}
              title="Түгээмэл асуулт"
              text={faqCount > 0 ? `${faqCount} асуулт` : "Word файлаас оруулах"}
            />
            <NavRow
              href={`/teacher/courses/${course.id}/search`}
              icon={<Search className="h-4 w-4" />}
              title="Хайлт турших"
              text="Систем юу олохыг шалгах"
            />
          </div>
          <section>
            <h2 className="mb-3 text-lg font-semibold">
              Оюутнууд <span className="text-muted">({students.length})</span>
            </h2>
            <StudentsTable courseId={course.id} students={students} />
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}

function NavRow({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-5 py-4 hover:bg-surface-2/60">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary-soft text-primary-soft-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted" />
    </Link>
  );
}
