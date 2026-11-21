import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Chat from "@/components/chat/Chat";
import BackLink from "@/components/courses/BackLink";
import DashboardShell, { DashboardSkeleton } from "@/components/dashboard/DashboardShell";
import { apiGet } from "@/lib/api-server";
import { requireRole } from "@/lib/auth";
import type { Conversation, ConversationDetail, Course } from "@/lib/types";

export const metadata: Metadata = { title: "AI туслах · AI Сургалтын Туслах" };

/** /teacher/courses/1/chat?c=7 — the course chat (c = an earlier conversation to open). */
export default function TeacherChatPage({ params, searchParams }: PageProps<"/teacher/courses/[id]/chat">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <TeacherChat params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function TeacherChat({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("teacher");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!/^\d+$/.test(id)) notFound();
  const c = typeof query.c === "string" && /^\d+$/.test(query.c) ? query.c : null;

  const [courseRes, listRes, detailRes] = await Promise.all([
    apiGet<Course>(`/api/courses/${id}`),
    apiGet<Conversation[]>(`/api/courses/${id}/conversations`),
    c ? apiGet<ConversationDetail>(`/api/courses/${id}/conversations/${c}`) : Promise.resolve(null),
  ]);
  if (!courseRes.ok) notFound();

  return (
    <DashboardShell user={user}>
      <BackLink href={`/teacher/courses/${id}`} label={courseRes.data.title} />
      <h1 className="mt-3 text-2xl font-bold tracking-tight">AI туслах</h1>
      <Chat
        courseId={courseRes.data.id}
        basePath={`/teacher/courses/${id}`}
        conversations={listRes.ok ? listRes.data : []}
        initial={detailRes?.ok ? detailRes.data : null}
      />
    </DashboardShell>
  );
}
