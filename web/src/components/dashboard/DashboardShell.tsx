import Link from "next/link";
import { Sparkles } from "lucide-react";
import { roleLabel, type User } from "@/lib/types";
import LogoutButton from "./LogoutButton";

/** Top bar (logo, user, role, logout) + page content. Shared by all dashboards. */
export default function DashboardShell({ user, children }: { user: User; children: React.ReactNode }) {
  const initials = user.full_name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <span className="hidden sm:inline">AI Туслах</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-soft-foreground">
                {initials}
              </span>
              <div className="leading-tight">
                <p className="max-w-[10rem] truncate text-sm font-medium sm:max-w-none">{user.full_name}</p>
                <p className="text-xs text-muted">{roleLabel[user.role]}</p>
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
    </div>
  );
}

/** Shown while the user is being loaded. */
export function DashboardSkeleton() {
  return (
    <div className="flex min-h-screen flex-col" aria-busy="true">
      <div className="h-16 border-b border-border" />
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-10">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-surface-2" />
        <div className="grid gap-4 pt-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}
