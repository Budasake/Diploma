"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle, Search } from "lucide-react";
import { groupFaq, type FaqItem } from "@/lib/types";

/** Student view: the teacher's FAQ grouped by category, with a quick filter. */
export default function FaqList({ items }: { items: FaqItem[] }) {
  const [filter, setFilter] = useState("");

  if (items.length === 0) {
    return (
      <div className="glass flex flex-col items-center rounded-2xl px-6 py-10 text-center">
        <HelpCircle className="h-8 w-8 text-muted" />
        <p className="mt-3 font-medium">Багш одоогоор түгээмэл асуулт оруулаагүй байна</p>
      </div>
    );
  }

  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? items.filter((i) => `${i.question} ${i.answer}`.toLowerCase().includes(needle))
    : items;

  return (
    <div className="space-y-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Асуултаас хайх…"
          className="w-full rounded-xl border border-border bg-surface py-2.5 pr-4 pl-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </label>
      {shown.length === 0 && <p className="text-center text-sm text-muted">Тохирох асуулт олдсонгүй.</p>}
      {groupFaq(shown).map(([category, group]) => (
        <section key={category}>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{category}</h3>
          <div className="glass divide-y divide-border overflow-hidden rounded-2xl">
            {group.map((item) => (
              <details key={item.id} className="group px-4 py-3 sm:px-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                  {item.question}
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm break-words whitespace-pre-line text-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
