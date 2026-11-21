import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BackLink from "@/components/courses/BackLink";
import DashboardShell, { DashboardSkeleton } from "@/components/dashboard/DashboardShell";
import MaterialViewer from "@/components/materials/MaterialViewer";
import { apiGet } from "@/lib/api-server";
import { requireRole } from "@/lib/auth";
import type { Material } from "@/lib/types";

export const metadata: Metadata = { title: "Материал · AI Сургалтын Туслах" };

/** /student/courses/1/materials/5?page=12 — open a file at a page (citations link here). */
export default function StudentMaterialPage({ params, searchParams }: PageProps<"/student/courses/[id]/materials/[mid]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <StudentMaterial params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function StudentMaterial({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; mid: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("student");
  const [{ id, mid }, query] = await Promise.all([params, searchParams]);
  if (!/^\d+$/.test(id) || !/^\d+$/.test(mid)) notFound();
  const page = Number(typeof query.page === "string" ? query.page : 1) || 1;

  const result = await apiGet<Material>(`/api/courses/${id}/materials/${mid}`);
  if (!result.ok) notFound();
  const material = result.data;

  return (
    <DashboardShell user={user}>
      <BackLink href={`/student/courses/${id}`} label="Хичээл рүү буцах" />
      <h1 className="mt-4 break-words text-2xl font-bold tracking-tight">{material.filename}</h1>
      <MaterialViewer material={material} initialPage={page} showText={false} />
    </DashboardShell>
  );
}
