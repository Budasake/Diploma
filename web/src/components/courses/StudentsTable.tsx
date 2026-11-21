"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, Users } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Student } from "@/lib/types";

/** Students in a course, with a "remove" button per row (teacher only). */
export default function StudentsTable({ courseId, students }: { courseId: number; students: Student[] }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<number | null>(null);

  async function remove(student: Student) {
    if (!confirm(`${student.full_name}-г хичээлээс хасах уу?`)) return;
    setRemoving(student.id);
    try {
      await fetch(`/api/courses/${courseId}/students/${student.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setRemoving(null);
    }
  }

  if (students.length === 0) {
    return (
      <div className="glass flex flex-col items-center rounded-2xl px-6 py-10 text-center">
        <Users className="h-8 w-8 text-muted" />
        <p className="mt-3 font-medium">Одоогоор оюутан нэгдээгүй байна</p>
        <p className="mt-1 text-sm text-muted">Дээрх кодыг оюутнууддаа илгээгээрэй.</p>
      </div>
    );
  }

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <ul className="divide-y divide-border">
        {students.map((student) => (
          <li key={student.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{student.full_name}</p>
              <p className="truncate text-sm text-muted">{student.email}</p>
            </div>
            <span className="hidden text-sm text-muted sm:block">{formatDate(student.joined_at)}</span>
            <button
              type="button"
              onClick={() => remove(student)}
              disabled={removing === student.id}
              aria-label={`${student.full_name}-г хасах`}
              className="rounded-lg p-2 text-muted hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
            >
              <UserMinus className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
