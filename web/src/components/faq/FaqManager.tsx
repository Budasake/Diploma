"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, FileUp, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import FormAlert from "@/components/auth/FormAlert";
import { NETWORK_ERROR, errorMessageFrom } from "@/lib/api-errors";
import { groupFaq, type FaqImportResult, type FaqItem } from "@/lib/types";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";

/** Teacher's FAQ page: import from DOCX, add, edit, delete. */
export default function FaqManager({ courseId, items }: { courseId: number; items: FaqItem[] }) {
  const router = useRouter();
  const url = `/api/courses/${courseId}/faq`;
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // which action is running
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  /** Run a request, show its error if any, then reload the list from the server. */
  async function run(key: string, request: () => Promise<Response>): Promise<Response | null> {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const res = await request();
      if (!res.ok) {
        setError(await errorMessageFrom(res));
        return null;
      }
      router.refresh();
      return res;
    } catch {
      setError(NETWORK_ERROR);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const res = await run("import", () => fetch(`${url}/import`, { method: "POST", body: form }));
    if (fileRef.current) fileRef.current.value = "";
    if (res) {
      const r = (await res.json()) as FaqImportResult;
      setNotice(
        `${r.found} асуулт олдлоо: ${r.added} шинээр нэмэгдсэн, ${r.updated} шинэчлэгдсэн, ${r.unchanged} өөрчлөгдөөгүй.`,
      );
    }
  }

  async function save(event: FormEvent<HTMLFormElement>, item: FaqItem | null) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = JSON.stringify({
      category: String(data.get("category") ?? "").trim(),
      question: String(data.get("question") ?? "").trim(),
      answer: String(data.get("answer") ?? "").trim(),
    });
    const res = await run(item ? `edit-${item.id}` : "add", () =>
      fetch(item ? `${url}/${item.id}` : url, {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
    );
    if (res) {
      setEditing(null);
      setAdding(false);
    }
  }

  async function remove(item: FaqItem) {
    if (!confirm(`«${item.question}» асуултыг устгах уу?`)) return;
    await run(`delete-${item.id}`, () => fetch(`${url}/${item.id}`, { method: "DELETE" }));
  }

  async function removeAll() {
    if (!confirm(`Бүх ${items.length} асуултыг устгах уу? Энэ үйлдлийг буцаах боломжгүй.`)) return;
    await run("delete-all", () => fetch(url, { method: "DELETE" }));
  }

  return (
    <div className="space-y-6">
      {/* Import */}
      <div className="glass rounded-2xl p-5">
        <p className="flex items-center gap-2 font-medium">
          <FileUp className="h-4 w-4 text-primary-soft-foreground" /> Word файлаас оруулах
        </p>
        <p className="mt-1 text-sm text-muted">
          Файлд «Асуулт: …» ба «Хариулт: …» мөрүүд байх ёстой. Гарчгууд нь ангилал болно. Дахин оруулахад давхардахгүй,
          өөрчлөгдсөн хариултууд шинэчлэгдэнэ.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy === "import" && <LoaderCircle className="h-4 w-4 animate-spin" />}
            DOCX файл сонгох
          </button>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm hover:bg-surface-2"
          >
            <Plus className="h-4 w-4" /> Гараар нэмэх
          </button>
          {items.length > 0 && (
            <button
              type="button"
              onClick={removeAll}
              disabled={busy !== null}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" /> Бүгдийг устгах
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => importFile(e.target.files?.[0])}
          />
        </div>
        {notice && (
          <p role="status" className="mt-3 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {notice}
          </p>
        )}
      </div>

      {error && <FormAlert message={error} />}

      {adding && (
        <FaqForm item={null} busy={busy === "add"} onSubmit={(e) => save(e, null)} onCancel={() => setAdding(false)} />
      )}

      {items.length === 0 && !adding ? (
        <p className="text-center text-sm text-muted">Одоогоор түгээмэл асуулт байхгүй байна.</p>
      ) : (
        groupFaq(items).map(([category, group]) => (
          <section key={category}>
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">
              {category} <span className="font-normal">({group.length})</span>
            </h2>
            <ul className="glass divide-y divide-border overflow-hidden rounded-2xl">
              {group.map((item) =>
                editing === item.id ? (
                  <li key={item.id} className="p-3">
                    <FaqForm
                      item={item}
                      busy={busy === `edit-${item.id}`}
                      onSubmit={(e) => save(e, item)}
                      onCancel={() => setEditing(null)}
                    />
                  </li>
                ) : (
                  <li key={item.id} className="flex gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.question}</p>
                      <p className="mt-1 text-sm break-words whitespace-pre-line text-muted">{item.answer}</p>
                    </div>
                    <div className="flex shrink-0 items-start">
                      <button
                        type="button"
                        onClick={() => setEditing(item.id)}
                        aria-label="Засах"
                        title="Засах"
                        className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(item)}
                        disabled={busy === `delete-${item.id}`}
                        aria-label="Устгах"
                        title="Устгах"
                        className="rounded-lg p-2 text-muted hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function FaqForm({
  item,
  busy,
  onSubmit,
  onCancel,
}: {
  item: FaqItem | null;
  busy: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="glass space-y-3 rounded-2xl p-4">
      <input name="category" defaultValue={item?.category ?? ""} placeholder="Ангилал (заавал биш), ж: Үнэлгээ" maxLength={200} className={inputClass} />
      <input name="question" defaultValue={item?.question ?? ""} placeholder="Асуулт" required minLength={3} maxLength={1000} className={inputClass} />
      <textarea name="answer" defaultValue={item?.answer ?? ""} placeholder="Хариулт" required rows={3} maxLength={5000} className={inputClass} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-muted hover:bg-surface-2">
          <X className="h-4 w-4" /> Болих
        </button>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Хадгалах
        </button>
      </div>
    </form>
  );
}
