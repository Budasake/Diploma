import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BackLink from "@/components/courses/BackLink";
import DashboardShell, { DashboardSkeleton } from "@/components/dashboard/DashboardShell";
import FaqManager from "@/components/faq/FaqManager";
import { apiGet } from "@/lib/api-server";
import { requireRole } from "@/lib/auth";
import type { Course, FaqItem } from "@/lib/types";

export const metadata: Metadata = { title: "Түгээмэл асуулт · AI Сургалтын Туслах" };

export default function TeacherFaqPage({ params }: PageProps<"/teacher/courses/[id]/faq">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <TeacherFaq params={params} />
    </Suspense>
  );
}

async function TeacherFaq({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("teacher");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const [courseRes, faqRes] = await Promise.all([
    apiGet<Course>(`/api/courses/${id}`),
    apiGet<FaqItem[]>(`/api/courses/${id}/faq`),
  ]);
  if (!courseRes.ok) notFound();

  return (
    <DashboardShell user={user}>
      <BackLink href={`/teacher/courses/${id}`} label={courseRes.data.title} />
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Түгээмэл асуулт</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Оюутны асуулт эдгээрийн аль нэгтэй утгаараа таарвал AI ашиглахгүйгээр таны хариултыг шууд өгнө.
      </p>
      <div className="mt-8">
        <FaqManager courseId={courseRes.data.id} items={faqRes.ok ? faqRes.data : []} />
      </div>
    </DashboardShell>
  );
}
