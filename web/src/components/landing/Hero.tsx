import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ChatPreview from "./ChatPreview";

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Background: grid + two floating glows */}
      <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="animate-float absolute -top-40 left-[10%] -z-10 h-[420px] w-[520px] rounded-full bg-violet-600/30 blur-[120px]"
      />
      <div
        aria-hidden
        className="animate-float absolute top-40 right-[5%] -z-10 h-[360px] w-[420px] rounded-full bg-cyan-500/20 blur-[120px] [animation-delay:-5s]"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 md:grid-cols-2 md:py-28">
        {/* Left: message */}
        <div>
          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm text-primary-soft-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Багшийн материалд суурилсан AI
          </span>

          <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
            Хичээлээ ойлгох <span className="text-gradient">ухаалаг туслах</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-muted">
            Оюутан асуултаа асууж, багшийн лекц, лабораторийн материалаас эх сурвалжтай хариулт
            авна. Багшид хичээл бэлдэх, сорил үүсгэх, оюутнуудын явцыг хянахад AI тусална.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-6 py-3 font-medium text-white shadow-lg shadow-violet-500/30 transition-shadow hover:shadow-violet-500/50"
            >
              Эхлэх
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how"
              className="glass rounded-xl px-6 py-3 font-medium transition-colors hover:bg-surface-2"
            >
              Хэрхэн ажилладаг вэ?
            </a>
          </div>
        </div>

        {/* Right: animated example chat */}
        <ChatPreview />
      </div>
    </section>
  );
}
