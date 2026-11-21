import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, ListChecks, MessageSquare } from "lucide-react";
import ComingSoonCards from "@/components/dashboard/ComingSoonCards";
import DashboardShell, { DashboardSkeleton } from "@/components/dashboard/DashboardShell";
import { apiGet } from "@/lib/api-server";
import { requireRole } from "@/lib/auth";
import type { Course } from "@/lib/types";

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

  const result = await apiGet<Course>(`/api/courses/${id}`);
  if (!result.ok) notFound(); // not enrolled or doesn't exist
  const course = result.data;

  return (
    <DashboardShell user={user}>
      <Link href="/student" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Миний хичээлүүд
      </Link>

      {course.code && <p className="mt-4 font-mono text-sm text-muted">{course.code}</p>}
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{course.title}</h1>
      <p className="mt-2 text-muted">Багш: {course.teacher_name}</p>
      {course.description && <p className="mt-3 max-w-2xl text-muted">{course.description}</p>}

      <ComingSoonCards
        items={[
          { icon: MessageSquare, title: "AI туслах", text: "Энэ хичээлийн материалаас асуулт асуух." },
          { icon: FileText, title: "Материал", text: "Лекц, лабораторийн файлууд." },
          { icon: ListChecks, title: "Сорил", text: "Багшийн баталсан тестээр давтах." },
        ]}
      />
    </DashboardShell>
  );
}
