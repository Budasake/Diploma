import { Suspense } from "react";
import type { Metadata } from "next";
import { Activity, Settings, Users } from "lucide-react";
import ComingSoonCards from "@/components/dashboard/ComingSoonCards";
import DashboardShell, { DashboardSkeleton } from "@/components/dashboard/DashboardShell";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Админ самбар · AI Сургалтын Туслах" };

export default function AdminPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AdminDashboard />
    </Suspense>
  );
}

async function AdminDashboard() {
  const user = await requireRole("admin");

  return (
    <DashboardShell user={user}>
      <h1 className="text-3xl font-bold tracking-tight">Админ самбар</h1>
      <p className="mt-2 text-muted">Системийн хэрэглэгч, тохиргоог удирдана.</p>
      <ComingSoonCards
        items={[
          { icon: Users, title: "Хэрэглэгчид", text: "Багш, оюутны бүртгэл, эрх олгох." },
          { icon: Activity, title: "AI ашиглалт", text: "LLM дуудлага, хэмнэлт, зардал." },
          { icon: Settings, title: "Тохиргоо", text: "Системийн ерөнхий тохиргоо." },
        ]}
      />
    </DashboardShell>
  );
}
