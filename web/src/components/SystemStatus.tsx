"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "ok" | "down";

const labels: Record<Status, string> = {
  checking: "Систем шалгаж байна…",
  ok: "Систем хэвийн ажиллаж байна",
  down: "Сервертэй холбогдож чадсангүй",
};

const dotColors: Record<Status, string> = {
  checking: "bg-white/40",
  ok: "bg-success",
  down: "bg-red-400",
};

/** Small indicator that calls the backend's /api/health endpoint. */
export default function SystemStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal, cache: "no-store" })
      .then((res) => res.json())
      .then((data: { status?: string }) => setStatus(data.status === "ok" ? "ok" : "down"))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("down");
      });
    return () => controller.abort();
  }, []);

  return (
    <span className="inline-flex items-center gap-2" role="status">
      <span className={`h-2 w-2 rounded-full ${dotColors[status]}`} />
      {labels[status]}
    </span>
  );
}
