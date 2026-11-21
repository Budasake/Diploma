import type { LucideIcon } from "lucide-react";

export type ComingSoonItem = { icon: LucideIcon; title: string; text: string };

/** Placeholder cards for features that later milestones will build. */
export default function ComingSoonCards({ items }: { items: ComingSoonItem[] }) {
  return (
    <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map(({ icon: Icon, title, text }) => (
        <div key={title} className="glass rounded-2xl p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary-soft text-primary-soft-foreground">
            <Icon className="h-5 w-5" />
          </span>
          <p className="mt-4 font-medium">{title}</p>
          <p className="mt-1 text-sm text-muted">{text}</p>
          <span className="mt-4 inline-block rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">
            Удахгүй
          </span>
        </div>
      ))}
    </div>
  );
}
