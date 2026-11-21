import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { formatSize } from "@/lib/format";
import type { Material } from "@/lib/types";

/** Read-only list of a course's ready materials, for students. */
export default function StudentMaterialList({ materials }: { materials: Material[] }) {
  if (materials.length === 0) {
    return (
      <div className="glass flex flex-col items-center rounded-2xl px-6 py-10 text-center">
        <FileText className="h-8 w-8 text-muted" />
        <p className="mt-3 font-medium">Багш одоогоор материал оруулаагүй байна</p>
      </div>
    );
  }

  return (
    <ul className="glass divide-y divide-border overflow-hidden rounded-2xl">
      {materials.map((m) => (
        <li key={m.id}>
          <Link
            href={`/student/courses/${m.course_id}/materials/${m.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60 sm:px-5"
          >
            <FileText className="h-5 w-5 shrink-0 text-primary-soft-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{m.filename}</span>
              <span className="block text-xs text-muted">
                {m.file_type.toUpperCase()} · {formatSize(m.size_bytes)}
                {m.page_count != null && ` · ${m.page_count} хуудас`}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
