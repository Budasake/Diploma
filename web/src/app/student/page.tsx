import { Suspense } from "react";
import type { Metadata } from "next";
import { BookOpen, ListChecks, MessageSquare } from "lucide-react";
import ComingSoonCards from "@/components/dashboard/ComingSoonCards";
import DashboardShell, { DashboardSkeleton } from "@/components/dashboard/DashboardShell";
import { requireRole } from "@/lib/auth";

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
  const firstName = user.full_name.split(/\s+/).at(-1);

  return (
    <DashboardShell user={user}>
      <h1 className="text-3xl font-bold tracking-tight">Сайн байна уу, {firstName}! 👋</h1>
      <p className="mt-2 text-muted">Таны хичээлүүд болон AI туслах энд гарч ирнэ.</p>
      <ComingSoonCards
        items={[
          { icon: BookOpen, title: "Миний хичээлүүд", text: "Бүртгүүлсэн хичээлүүд, лекцийн материал." },
          { icon: MessageSquare, title: "AI туслах", text: "Хичээлийн материалаас эх сурвалжтай хариулт." },
          { icon: ListChecks, title: "Сорил", text: "Багшийн баталсан тестээр давтах." },
        ]}
      />
    </DashboardShell>
  );
}
