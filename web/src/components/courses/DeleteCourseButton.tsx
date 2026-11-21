"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteCourseButton({ courseId, title }: { courseId: number; title: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (!confirm(`"${title}" хичээлийг устгах уу? Оюутнуудын бүртгэл мөн устна. Буцаах боломжгүй.`)) return;
    setPending(true);
    const res = await fetch(`/api/courses/${courseId}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      router.replace("/teacher");
      router.refresh();
    } else {
      setPending(false);
      alert("Устгаж чадсангүй. Дахин оролдоно уу.");
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-60"
    >
      <Trash2 className="h-4 w-4" /> Хичээл устгах
    </button>
  );
}
