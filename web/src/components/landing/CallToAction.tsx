import Link from "next/link";

export default function CallToAction() {
  return (
    <section className="px-4 pb-24">
      <div className="relative isolate mx-auto max-w-5xl overflow-hidden rounded-3xl border border-primary/30 px-6 py-16 text-center">
        {/* Gradient glow background */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-brand-gradient opacity-20" />
        <div
          aria-hidden
          className="absolute -top-24 left-1/2 -z-10 h-64 w-[600px] -translate-x-1/2 rounded-full bg-violet-500/40 blur-[100px]"
        />
        <div aria-hidden className="bg-grid absolute inset-0 -z-10" />

        <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
          Хичээлээ илүү <span className="text-gradient">ухаалаг</span> болгоё
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          Бүртгэл үүсгээд хичээлийн материалаа оруулж эсвэл асуултаа асууж эхлээрэй.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="rounded-xl bg-white px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
          >
            Бүртгүүлэх
          </Link>
          <Link href="/login" className="glass rounded-xl px-6 py-3 font-medium transition-colors hover:bg-surface-2">
            Нэвтрэх
          </Link>
        </div>
      </div>
    </section>
  );
}
