"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { FileText, HelpCircle, LoaderCircle, Search } from "lucide-react";
import FormAlert from "@/components/auth/FormAlert";
import { NETWORK_ERROR, errorMessageFrom } from "@/lib/api-errors";
import type { SearchResult } from "@/lib/types";

/** Similarity 0…1 as a small bar: how close in meaning the match is. */
function Score({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const color = value >= 0.75 ? "bg-emerald-400" : value >= 0.5 ? "bg-amber-400" : "bg-muted/60";
  return (
    <span className="inline-flex shrink-0 items-center gap-2 text-xs text-muted" title="Утгын ойролцоо байдал">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
        <span className={`block h-full ${color}`} style={{ width: `${pct}%` }} />
      </span>
      {value.toFixed(2)}
    </span>
  );
}

/**
 * Teacher types a question and sees what the system would find: the closest FAQ
 * questions and the closest passages in the materials. No AI answer is written —
 * this shows the raw search the answer router (M3) will build on.
 */
export default function SearchTester({ courseId }: { courseId: number }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) setError(await errorMessageFrom(res));
      else setResult((await res.json()) as SearchResult);
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Оюутан асуух асуулт, ж: Ирц хэдэн оноотой вэ?"
          maxLength={500}
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Хайх
        </button>
      </form>

      {error && <FormAlert message={error} />}

      {result && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <HelpCircle className="h-4 w-4 text-primary-soft-foreground" /> Түгээмэл асуултаас
            </h2>
            {result.faq.length === 0 ? (
              <p className="text-sm text-muted">Түгээмэл асуулт оруулаагүй байна.</p>
            ) : (
              <ul className="space-y-3">
                {result.faq.map((hit) => (
                  <li key={hit.id} className="glass rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{hit.question}</p>
                      <Score value={hit.similarity} />
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-line text-muted">{hit.answer}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <FileText className="h-4 w-4 text-primary-soft-foreground" /> Материалаас
            </h2>
            {result.chunks.length === 0 ? (
              <p className="text-sm text-muted">Бэлэн материал алга.</p>
            ) : (
              <ul className="space-y-3">
                {result.chunks.map((hit, i) => (
                  <li key={i} className="glass rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/teacher/courses/${courseId}/materials/${hit.material_id}${hit.page ? `?page=${hit.page}` : ""}`}
                        className="min-w-0 text-sm font-medium break-words hover:underline"
                      >
                        {hit.filename}
                        {hit.page && <span className="text-muted"> · {hit.page}-р хуудас</span>}
                      </Link>
                      <Score value={hit.similarity} />
                    </div>
                    <p className="mt-2 line-clamp-4 text-sm whitespace-pre-line text-muted">{hit.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
