import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListChecks, MessageSquare } from "lucide-react";
import ComingSoonCards from "@/components/dashboard/ComingSoonCards";
import DashboardShell, { DashboardSkeleton } from "@/components/dashboard/DashboardShell";
import StudentMaterialList from "@/components/materials/StudentMaterialList";
import { apiGet } from "@/lib/api-server";
import { requireRole } from "@/lib/auth";
import type { Course, Material } from "@/lib/types";

export const metadata: Metadata = { title: "Хичээл · AI Сургалтын Туслах" };

export default function StudentCoursePage({ params }: PageProps<"/student/courses/[id]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <StudentCourse params={params} />
    </Suspense>
  );
}

async function StudentCourse({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("student");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const [result, materialsRes] = await Promise.all([
    apiGet<Course>(`/api/courses/${id}`),
    apiGet<Material[]>(`/api/courses/${id}/materials`),
  ]);
  if (!result.ok) notFound(); // not enrolled or doesn't exist
  const course = result.data;
  const materials = materialsRes.ok ? materialsRes.data : [];

  return (
    <DashboardShell user={user}>
      <Link href="/student" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Миний хичээлүүд
      </Link>

      {course.code && <p className="mt-4 font-mono text-sm text-muted">{course.code}</p>}
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{course.title}</h1>
      <p className="mt-2 text-muted">Багш: {course.teacher_name}</p>
      {course.description && <p className="mt-3 max-w-2xl text-muted">{course.description}</p>}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">
          Материал <span className="text-muted">({materials.length})</span>
        </h2>
        <StudentMaterialList materials={materials} />
      </section>

      <ComingSoonCards
        items={[
          { icon: MessageSquare, title: "AI туслах", text: "Энэ хичээлийн материалаас асуулт асуух." },
          { icon: ListChecks, title: "Сорил", text: "Багшийн баталсан тестээр давтах." },
        ]}
      />
    </DashboardShell>
  );
}
