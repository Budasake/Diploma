import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, BookOpen, Database, FileSearch, HelpCircle, MessageCircle, Sparkles } from "lucide-react";
import type { ChatMessage, Citation, Route } from "@/lib/types";

/** How each router step is shown to the student — the answer's "source of truth". */
const ROUTES: Record<Route, { label: string; icon: ReactNode; className: string }> = {
  rule: { label: "Шууд хариулт", icon: <MessageCircle className="h-3 w-3" />, className: "text-muted" },
  faq: { label: "Багшийн хариулт", icon: <HelpCircle className="h-3 w-3" />, className: "text-emerald-300" },
  cache: { label: "Өмнө хариулсан", icon: <Database className="h-3 w-3" />, className: "text-cyan-300" },
  not_found: { label: "Материалд олдсонгүй", icon: <FileSearch className="h-3 w-3" />, className: "text-amber-300" },
  llm: { label: "AI · материалаас", icon: <Sparkles className="h-3 w-3" />, className: "text-primary-soft-foreground" },
  error: { label: "Алдаа", icon: <AlertTriangle className="h-3 w-3" />, className: "text-red-300" },
};

export function RouteBadge({ route }: { route: Route }) {
  const r = ROUTES[route];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${r.className}`}>
      {r.icon}
      {r.label}
    </span>
  );
}

function citationHref(basePath: string, c: Citation) {
  return `${basePath}/materials/${c.material_id}${c.page ? `?page=${c.page}` : ""}`;
}

/** Turn "… [1] …" in the answer into small links to the cited page. */
function withCitationLinks(text: string, citations: Citation[], basePath: string): ReactNode[] {
  const byN = new Map(citations.map((c) => [c.n, c]));
  return text.split(/(\[\d+(?:,\s*\d+)*\])/g).map((part, i) => {
    const numbers = part.match(/^\[(.+)\]$/)?.[1].split(",").map((x) => Number(x.trim()));
    if (!numbers) return <Fragment key={i}>{part}</Fragment>;
    return (
      <Fragment key={i}>
        {numbers.map((n) => {
          const c = byN.get(n);
          if (!c) return null;
          return (
            <Link
              key={n}
              href={citationHref(basePath, c)}
              title={`${c.filename}${c.page ? `, ${c.page}-р хуудас` : ""}`}
              className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-primary/25 px-1 align-super text-[10px] font-semibold text-primary-soft-foreground no-underline hover:bg-primary/40"
            >
              {n}
            </Link>
          );
        })}
      </Fragment>
    );
  });
}

/** Two passages from the same page become one chip: "1, 2 · lab2.pdf · 1-р хуудас". */
function groupByPage(citations: Citation[]) {
  const groups = new Map<string, { key: string; numbers: number[]; c: Citation }>();
  for (const c of citations) {
    const key = `${c.material_id}:${c.page ?? ""}`;
    const group = groups.get(key);
    if (group) group.numbers.push(c.n);
    else groups.set(key, { key, numbers: [c.n], c });
  }
  return [...groups.values()];
}

export default function MessageBubble({
  message,
  basePath,
  streaming = false,
}: {
  message: Pick<ChatMessage, "role" | "content" | "route" | "citations">;
  basePath: string;
  streaming?: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-gradient px-4 py-2.5 break-words whitespace-pre-line text-white">
          {message.content}
        </p>
      </div>
    );
  }

  const citations = message.citations ?? [];
  return (
    <div className="flex justify-start">
      <div className="glass max-w-[85%] min-w-0 rounded-2xl rounded-bl-md px-4 py-3">
        {message.route && (
          <div className="mb-1.5">
            <RouteBadge route={message.route} />
          </div>
        )}
        <div className="leading-relaxed break-words whitespace-pre-line">
          {withCitationLinks(message.content, citations, basePath)}
          {streaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />}
        </div>
        {citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
            {groupByPage(citations).map(({ key, numbers, c }) => (
              <Link
                key={key}
                href={citationHref(basePath, c)}
                className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-surface-2/70 px-2 py-1 text-xs text-muted hover:text-foreground"
              >
                <span className="font-semibold text-primary-soft-foreground">{numbers.join(", ")}</span>
                <BookOpen className="h-3 w-3 shrink-0" />
                <span className="truncate">{c.filename}</span>
                {c.page && <span className="shrink-0">· {c.page}-р хуудас</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
