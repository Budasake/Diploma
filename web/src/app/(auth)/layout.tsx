import Link from "next/link";
import { Sparkles } from "lucide-react";

/** Shared frame for /login and /register: logo, glow background, centered card. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="absolute -top-32 left-1/2 -z-10 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-violet-600/25 blur-[120px]"
      />

      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient shadow-lg shadow-violet-500/30">
          <Sparkles className="h-4 w-4 text-white" />
        </span>
        AI Туслах
      </Link>

      <div className="glass w-full max-w-md rounded-3xl p-6 shadow-2xl sm:p-8">{children}</div>
    </div>
  );
}
