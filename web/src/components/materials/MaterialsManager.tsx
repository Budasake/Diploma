"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { FileText, FileUp, LoaderCircle, RotateCw, Trash2 } from "lucide-react";
import FormAlert from "@/components/auth/FormAlert";
import MaterialStatusBadge from "@/components/materials/MaterialStatusBadge";
import { NETWORK_ERROR, errorMessageFrom, messageForCode } from "@/lib/api-errors";
import { formatDate, formatSize } from "@/lib/format";
import type { Material } from "@/lib/types";

const MAX_MB = 50;
const ALLOWED = ["pdf", "docx"];
const POLL_MS = 2000;

type Upload = { key: string; name: string; progress: number };

/**
 * Teacher's materials panel: drop/choose files → upload with a progress bar →
 * the list shows each file's processing status and refreshes itself until all are done.
 */
export default function MaterialsManager({
  courseId,
  initialMaterials,
}: {
  courseId: number;
  initialMaterials: Material[];
}) {
  const [materials, setMaterials] = useState(initialMaterials);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listUrl = `/api/courses/${courseId}/materials`;

  async function reload() {
    try {
      const res = await fetch(listUrl, { cache: "no-store" });
      if (res.ok) setMaterials((await res.json()) as Material[]);
    } catch {
      // try again on the next tick
    }
  }

  // While any file is still processing, ask the server again every 2 seconds.
  const anyProcessing = materials.some((m) => m.status === "processing");
  useEffect(() => {
    if (!anyProcessing) return;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyProcessing]);

  /** XMLHttpRequest (not fetch) because only it reports upload progress. */
  function uploadOne(file: File): Promise<void> {
    const key = `${file.name}-${file.size}-${Date.now()}`;
    setUploads((u) => [...u, { key, name: file.name, progress: 0 }]);
    const done = () => setUploads((u) => u.filter((x) => x.key !== key));

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", listUrl);
      xhr.responseType = "json";
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const progress = Math.round((e.loaded / e.total) * 100);
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress } : x)));
      };
      xhr.onload = () => {
        done();
        if (xhr.status === 202) {
          setMaterials((m) => [...m, xhr.response as Material]);
        } else {
          setErrors((e) => [...e, `${file.name}: ${messageForCode(xhr.response?.detail)}`]);
        }
        resolve();
      };
      xhr.onerror = () => {
        done();
        setErrors((e) => [...e, `${file.name}: ${NETWORK_ERROR}`]);
        resolve();
      };
      const form = new FormData();
      form.append("file", file);
      xhr.send(form);
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setErrors([]);
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED.includes(ext)) {
        setErrors((e) => [...e, `${file.name}: ${messageForCode("unsupported_file_type")}`]);
      } else if (file.size > MAX_MB * 1024 * 1024) {
        setErrors((e) => [...e, `${file.name}: ${messageForCode("file_too_large")}`]);
      } else {
        await uploadOne(file); // one at a time keeps the server and the list calm
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  async function act(material: Material, action: "delete" | "reprocess") {
    if (action === "delete" && !confirm(`«${material.filename}» файлыг устгах уу?`)) return;
    setBusyId(material.id);
    setErrors([]);
    try {
      const res = await fetch(
        action === "delete" ? `${listUrl}/${material.id}` : `${listUrl}/${material.id}/reprocess`,
        { method: action === "delete" ? "DELETE" : "POST" },
      );
      if (!res.ok) setErrors([await errorMessageFrom(res)]);
      await reload();
    } catch {
      setErrors([NETWORK_ERROR]);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragging ? "border-primary bg-primary-soft" : "border-border bg-surface/40"
        }`}
      >
        <FileUp className="h-8 w-8 text-primary-soft-foreground" />
        <p className="mt-3 font-medium">Файлаа энд чирж оруулна уу</p>
        <p className="mt-1 text-sm text-muted">PDF эсвэл DOCX, нэг файл {MAX_MB} MB хүртэл</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-4 rounded-xl bg-brand-gradient px-5 py-2 text-sm font-medium text-white"
        >
          Файл сонгох
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {errors.map((message) => (
        <FormAlert key={message} message={message} />
      ))}

      {/* Uploads in progress */}
      {uploads.map((u) => (
        <div key={u.key} className="glass rounded-xl px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{u.name}</span>
            <span className="shrink-0 text-muted">{u.progress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-brand-gradient transition-[width]" style={{ width: `${u.progress}%` }} />
          </div>
        </div>
      ))}

      {/* Files */}
      {materials.length === 0 && uploads.length === 0 ? (
        <p className="text-center text-sm text-muted">Одоогоор материал оруулаагүй байна.</p>
      ) : (
        <ul className="glass divide-y divide-border overflow-hidden rounded-2xl">
          {materials.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <FileText className="h-5 w-5 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/teacher/courses/${courseId}/materials/${m.id}`}
                  className="block max-w-full truncate font-medium hover:underline"
                >
                  {m.filename}
                </Link>
                <p className="text-xs text-muted">
                  {m.file_type.toUpperCase()} · {formatSize(m.size_bytes)}
                  {m.page_count != null && ` · ${m.page_count} хуудас`}
                  {m.status === "ready" && ` · ${m.chunk_count} хэсэг`} · {formatDate(m.created_at)}
                </p>
                {m.status === "no_text" && (
                  <p className="mt-1 text-xs text-amber-300/90">
                    Файлаас текст уншигдсангүй (скан хийсэн зураг байж магадгүй). Тексттэй хувилбарыг оруулна уу.
                  </p>
                )}
                {m.status === "failed" && (
                  <p className="mt-1 text-xs text-red-300/90">
                    {m.error === "interrupted"
                      ? "Сервер дахин эхэлсэн тул боловсруулалт тасарсан."
                      : "Файлыг уншихад алдаа гарлаа. Дахин боловсруулж үзнэ үү."}
                  </p>
                )}
              </div>
              <MaterialStatusBadge status={m.status} />
              <div className="flex items-center">
                {(m.status === "failed" || m.status === "no_text") && (
                  <button
                    type="button"
                    onClick={() => act(m, "reprocess")}
                    disabled={busyId === m.id}
                    aria-label={`${m.filename}-г дахин боловсруулах`}
                    title="Дахин боловсруулах"
                    className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => act(m, "delete")}
                  disabled={busyId === m.id || m.status === "processing"}
                  aria-label={`${m.filename}-г устгах`}
                  title="Устгах"
                  className="rounded-lg p-2 text-muted hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                >
                  {busyId === m.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
