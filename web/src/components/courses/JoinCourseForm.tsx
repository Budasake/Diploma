"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle } from "lucide-react";
import FormAlert from "@/components/auth/FormAlert";
import { NETWORK_ERROR, errorMessageFrom } from "@/lib/api-errors";
import type { Course } from "@/lib/types";

/** Student types the 6-character code from their teacher. */
export default function JoinCourseForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const joinCode = code.trim().toUpperCase();
    if (joinCode.length < 4) {
      setError("Багшийн өгсөн кодыг оруулна уу.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/courses/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ join_code: joinCode }),
      });
      if (!res.ok) {
        setError(await errorMessageFrom(res));
        setPending(false);
        return;
      }
      const course = (await res.json()) as Course;
      router.push(`/student/courses/${course.id}`);
    } catch {
      setError(NETWORK_ERROR);
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="glass rounded-2xl p-5">
      <label htmlFor="join-code" className="flex items-center gap-2 font-medium">
        <KeyRound className="h-4 w-4 text-primary-soft-foreground" /> Хичээлд нэгдэх
      </label>
      <p className="mt-1 text-sm text-muted">Багшаасаа авсан 6 тэмдэгттэй кодыг оруулна уу.</p>
      <div className="mt-4 flex gap-2">
        <input
          id="join-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={12}
          autoComplete="off"
          spellCheck={false}
          placeholder="ЖНЭ: K7P2QX"
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 font-mono tracking-widest uppercase outline-none placeholder:font-sans placeholder:tracking-normal placeholder:normal-case placeholder:text-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
          Нэгдэх
        </button>
      </div>
      {error && (
        <div className="mt-3">
          <FormAlert message={error} />
        </div>
      )}
    </form>
  );
}
