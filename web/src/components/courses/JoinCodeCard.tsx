"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, RefreshCw } from "lucide-react";

/** Shows the course's join code with Copy and "New code" buttons (teacher only). */
export default function JoinCodeCard({ courseId, joinCode }: { courseId: number; joinCode: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the code is still visible to copy by hand.
    }
  }

  async function regenerate() {
    if (!confirm("Шинэ код үүсгэх үү? Хуучин код ажиллахаа болино (нэгдсэн оюутнууд үлдэнэ).")) return;
    setPending(true);
    try {
      await fetch(`/api/courses/${courseId}/join-code`, { method: "POST" });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-sm text-muted">Оюутнууд энэ кодоор хичээлд нэгдэнэ</p>
      <p className="mt-2 font-mono text-4xl font-bold tracking-[0.25em] text-gradient">{joinCode}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm hover:bg-white/15"
        >
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          {copied ? "Хуулсан" : "Хуулах"}
        </button>
        <button
          type="button"
          onClick={regenerate}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} /> Шинэ код
        </button>
      </div>
    </div>
  );
}
