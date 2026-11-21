import Link from "next/link";

export default function CallToAction() {
  return (
    <section className="px-4 pb-20">
      <div className="mx-auto max-w-4xl rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground">
        <h2 className="text-3xl font-bold tracking-tight">Хичээлээ илүү ухаалаг болгоё</h2>
        <p className="mx-auto mt-3 max-w-xl opacity-90">
          Бүртгэл үүсгээд хичээлийн материалаа оруулж эсвэл асуултаа асууж эхлээрэй.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-primary-foreground px-6 py-3 font-medium text-primary transition-opacity hover:opacity-90"
          >
            Бүртгүүлэх
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-primary-foreground/40 px-6 py-3 font-medium transition-colors hover:bg-primary-foreground/10"
          >
            Нэвтрэх
          </Link>
        </div>
      </div>
    </section>
  );
}
