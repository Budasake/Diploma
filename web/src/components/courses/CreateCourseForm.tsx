"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import FormAlert from "@/components/auth/FormAlert";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import { NETWORK_ERROR, errorMessageFrom } from "@/lib/api-errors";
import type { Course } from "@/lib/types";

/** "New course" button that opens a small form. On success it goes to the new course. */
export default function CreateCourseForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    setError(null);
    if (title.length < 2) {
      setTitleError("Хичээлийн нэрийг оруулна уу.");
      return;
    }
    setTitleError(undefined);
    setPending(true);

    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, code: form.get("code"), description: form.get("description") }),
      });
      if (!res.ok) {
        setError(await errorMessageFrom(res));
        setPending(false);
        return;
      }
      const course = (await res.json()) as Course;
      router.push(`/teacher/courses/${course.id}`);
    } catch {
      setError(NETWORK_ERROR);
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/30"
      >
        <Plus className="h-4 w-4" /> Шинэ хичээл
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="glass mt-6 w-full space-y-4 rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Шинэ хичээл үүсгэх</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Хаах" className="text-muted hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>
      {error && <FormAlert message={error} />}
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <FormField label="Хичээлийн нэр" name="title" error={titleError} placeholder="Программчлалын үндсэн аргууд" autoFocus />
        <FormField label="Хичээлийн код" name="code" placeholder="F.CSM101" />
      </div>
      <div>
        <label htmlFor="course-description" className="mb-1.5 block text-sm font-medium">
          Тайлбар <span className="font-normal text-muted">(заавал биш)</span>
        </label>
        <textarea
          id="course-description"
          name="description"
          rows={3}
          maxLength={2000}
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          placeholder="Хичээлийн товч танилцуулга"
        />
      </div>
      <div className="sm:w-48">
        <SubmitButton pending={pending}>{pending ? "Үүсгэж байна…" : "Үүсгэх"}</SubmitButton>
      </div>
    </form>
  );
}
