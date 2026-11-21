import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BackLink from "@/components/courses/BackLink";
import DashboardShell, { DashboardSkeleton } from "@/components/dashboard/DashboardShell";
import SearchTester from "@/components/search/SearchTester";
import { apiGet } from "@/lib/api-server";
import { requireRole } from "@/lib/auth";
import type { Course } from "@/lib/types";

export const metadata: Metadata = { title: "Хайлт турших · AI Сургалтын Туслах" };

export default function TeacherSearchPage({ params }: PageProps<"/teacher/courses/[id]/search">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <TeacherSearch params={params} />
    </Suspense>
  );
}

async function TeacherSearch({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("teacher");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const courseRes = await apiGet<Course>(`/api/courses/${id}`);
  if (!courseRes.ok) notFound();

  return (
    <DashboardShell user={user}>
      <BackLink href={`/teacher/courses/${id}`} label={courseRes.data.title} />
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Хайлт турших</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Оюутны асууж болох асуулт бичээд систем юу олохыг харна уу. Тоо нь утгын ойролцоо байдал: 1 бол яг ижил утга, 0
        бол огт хамааралгүй.
      </p>
      <div className="mt-8">
        <SearchTester courseId={courseRes.data.id} />
      </div>
    </DashboardShell>
  );
}
