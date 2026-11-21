import { Suspense } from "react";
import type { Metadata } from "next";
import { ChartColumn, Sparkles, Upload } from "lucide-react";
import ComingSoonCards from "@/components/dashboard/ComingSoonCards";
import DashboardShell, { DashboardSkeleton } from "@/components/dashboard/DashboardShell";
import { requireRole } from "@/lib/auth";

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

  return (
    <DashboardShell user={user}>
      <h1 className="text-3xl font-bold tracking-tight">Багшийн самбар</h1>
      <p className="mt-2 text-muted">Сайн байна уу, {user.full_name}. Хичээл, материалаа эндээс удирдана.</p>
      <ComingSoonCards
        items={[
          { icon: Upload, title: "Хичээл ба материал", text: "Хичээл үүсгэж, PDF, DOCX материал оруулах." },
          { icon: Sparkles, title: "AI контент батлах", text: "Хураангуй, сорилын ноорог шалгаж батлах." },
          { icon: ChartColumn, title: "Шинжилгээ", text: "Оюутнуудын асуулт, сорилын дүн." },
        ]}
      />
    </DashboardShell>
  );
}
