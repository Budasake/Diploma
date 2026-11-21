import Link from "next/link";
import { ArrowRight, FileText, Zap } from "lucide-react";

export default function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
      {/* Left: message */}
      <div>
        <span className="inline-block rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary-soft-foreground">
          Багшийн материалд суурилсан AI
        </span>
        <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
          Хичээлээ ойлгох ухаалаг сургалтын туслах
        </h1>
        <p className="mt-5 text-lg text-muted">
          Оюутан асуултаа асууж, багшийн лекц, лабораторийн материалаас эх сурвалжтай хариулт
          авна. Багшид хичээл бэлдэх, сорил үүсгэх, оюутнуудын явцыг хянахад AI тусална.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Эхлэх
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#how"
            className="rounded-lg border border-border px-6 py-3 font-medium transition-colors hover:bg-surface-2"
          >
            Хэрхэн ажилладаг вэ?
          </a>
        </div>
      </div>

      {/* Right: an illustrative chat (static, not a live AI call) */}
      <div aria-label="Чатын жишээ" className="rounded-2xl border border-border bg-surface p-5 shadow-xl">
        <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
          Санах ойн менежмент гэж юу вэ?
        </div>

        <div className="mt-4 max-w-[92%] rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-3 text-sm">
          Санах ойн менежмент нь программ ажиллах үед санах ойг хуваарилах, чөлөөлөх, хянах үйл
          явц юм. Үүнд stack болон heap санах ой багтана...
          <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-2 text-xs text-muted">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            Memory Management Lecture 5.pdf, хуудас 3
          </div>
        </div>

        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success">
          <Zap className="h-3.5 w-3.5" />
          Багшийн материалаас хариулсан · 0.3 сек
        </div>
      </div>
    </section>
  );
}
