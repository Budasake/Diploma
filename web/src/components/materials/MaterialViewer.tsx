"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, LoaderCircle, ScanText } from "lucide-react";
import { materialFileUrl, type Chunk, type Material } from "@/lib/types";

const VIEWER_HEIGHT = "75vh";

/**
 * Shows a course file. PDFs open inside the page at the chosen page (the browser's
 * own PDF viewer understands "#page=N" — this is how citations will jump to a page).
 * For teachers, a side panel shows the text the AI read from that page.
 */
export default function MaterialViewer({
  material,
  initialPage,
  showText,
}: {
  material: Material;
  initialPage: number;
  showText: boolean;
}) {
  const fileUrl = materialFileUrl(material);
  const pageCount = material.page_count ?? 1;
  const [page, setPage] = useState(Math.min(Math.max(initialPage, 1), pageCount));

  function go(next: number) {
    const p = Math.min(Math.max(next, 1), pageCount);
    setPage(p);
    // Keep ?page=N in the address bar, so the link can be copied or reloaded.
    window.history.replaceState(null, "", `?page=${p}`);
  }

  if (material.file_type !== "pdf") {
    return (
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="glass flex flex-col items-center rounded-2xl px-6 py-12 text-center">
          <FileText className="h-10 w-10 text-primary-soft-foreground" />
          <p className="mt-3 font-medium">Word файлыг хөтөч дотор харуулах боломжгүй</p>
          <p className="mt-1 text-sm text-muted">Татаж аваад Word эсвэл Google Docs-оор нээнэ үү.</p>
          <a
            href={fileUrl}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-5 py-2 text-sm font-medium text-white"
          >
            <Download className="h-4 w-4" /> Татах
          </a>
        </div>
        {showText && <PageText material={material} page={null} />}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          aria-label="Өмнөх хуудас"
          className="rounded-lg border border-border p-2 hover:bg-surface-2 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <label className="flex items-center gap-2 text-sm">
          Хуудас
          <input
            type="number"
            min={1}
            max={pageCount}
            value={page}
            onChange={(e) => go(Number(e.target.value) || 1)}
            className="w-16 rounded-lg border border-border bg-surface px-2 py-1.5 text-center outline-none focus:border-primary"
          />
          <span className="text-muted">/ {pageCount}</span>
        </label>
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= pageCount}
          aria-label="Дараагийн хуудас"
          className="rounded-lg border border-border p-2 hover:bg-surface-2 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <a
          href={`${fileUrl}#page=${page}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          Шинэ цонхонд нээх <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <p className="mt-3 text-xs text-muted sm:hidden">
        Утсан дээр PDF харагдахгүй бол «Шинэ цонхонд нээх» дээр дарна уу.
      </p>
      <div className={`mt-4 grid gap-6 ${showText ? "lg:grid-cols-[1fr_24rem]" : ""}`}>
        {/* key={page} reloads the viewer: browsers ignore a changed #page on an open PDF. */}
        <iframe
          key={page}
          src={`${fileUrl}#page=${page}`}
          title={material.filename}
          style={{ height: VIEWER_HEIGHT }}
          className="w-full rounded-2xl border border-border bg-white"
        />
        {showText && <PageText material={material} page={page} />}
      </div>
    </div>
  );
}

/** "What the AI read": the chunks stored for one page (or the whole DOCX). */
function PageText({ material, page }: { material: Material; page: number | null }) {
  const [chunks, setChunks] = useState<Chunk[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const query = page === null ? "" : `?page=${page}`;
    fetch(`/api/courses/${material.course_id}/materials/${material.id}/chunks${query}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: Chunk[]) => {
        if (cancelled) return;
        setChunks(data);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [material.course_id, material.id, page]);

  return (
    <aside style={{ maxHeight: VIEWER_HEIGHT }} className="glass flex flex-col rounded-2xl">
      <div className="border-b border-border px-5 py-4">
        <p className="flex items-center gap-2 font-medium">
          <ScanText className="h-4 w-4 text-primary-soft-foreground" />
          AI-ийн уншсан текст{page !== null && ` · ${page}-р хуудас`}
        </p>
        <p className="mt-1 text-xs text-muted">AI туслах зөвхөн энэ текстээс хайна. Буруу уншигдсан бол файлаа шалгана уу.</p>
      </div>
      <div className="space-y-3 overflow-y-auto px-5 py-4">
        {failed && <p className="text-sm text-red-300">Текстийг ачаалж чадсангүй.</p>}
        {!failed && chunks === null && <LoaderCircle className="h-5 w-5 animate-spin text-muted" />}
        {chunks?.length === 0 && (
          <p className="text-sm text-amber-300/90">Энэ хуудаснаас текст олдсонгүй (зураг эсвэл хоосон хуудас).</p>
        )}
        {chunks?.map((c) => (
          <div key={c.id} className="rounded-xl bg-surface-2/60 p-3">
            <p className="mb-1 text-xs text-muted">Хэсэг #{c.position + 1}</p>
            <p className="whitespace-pre-line text-sm leading-relaxed">{c.text}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
