import { AlertTriangle, CheckCircle2, FileQuestion, LoaderCircle } from "lucide-react";
import type { MaterialStatus } from "@/lib/types";

const styles: Record<MaterialStatus, { label: string; className: string }> = {
  processing: { label: "Боловсруулж байна", className: "bg-primary-soft text-primary-soft-foreground" },
  ready: { label: "Бэлэн", className: "bg-emerald-500/10 text-emerald-300" },
  no_text: { label: "Текст олдсонгүй", className: "bg-amber-500/10 text-amber-300" },
  failed: { label: "Алдаа гарсан", className: "bg-red-500/10 text-red-300" },
};

const icons = {
  processing: <LoaderCircle className="h-3.5 w-3.5 animate-spin" />,
  ready: <CheckCircle2 className="h-3.5 w-3.5" />,
  no_text: <FileQuestion className="h-3.5 w-3.5" />,
  failed: <AlertTriangle className="h-3.5 w-3.5" />,
};

/** Small coloured pill showing where a file is in processing. */
export default function MaterialStatusBadge({ status }: { status: MaterialStatus }) {
  const { label, className } = styles[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {icons[status]}
      {label}
    </span>
  );
}
