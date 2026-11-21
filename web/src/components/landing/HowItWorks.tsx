import type { LucideIcon } from "lucide-react";
import { Bot, CircleHelp, Database, Hand, Search } from "lucide-react";
import SectionHeading from "./SectionHeading";

type Step = { icon: LucideIcon; title: string; text: string; usesLlm: boolean };

// The answer router: each question stops at the first step that can answer it.
const steps: Step[] = [
  {
    icon: Hand,
    title: "Энгийн харилцаа",
    text: "Мэндчилгээ, талархалд шууд хариулна.",
    usesLlm: false,
  },
  {
    icon: CircleHelp,
    title: "Багшийн FAQ",
    text: "Багшийн бэлдсэн асуулт, хариултаас хайна.",
    usesLlm: false,
  },
  {
    icon: Database,
    title: "Хадгалсан хариулт",
    text: "Өмнө нь асуусан ижил утгатай асуултын хариултыг дахин ашиглана.",
    usesLlm: false,
  },
  {
    icon: Search,
    title: "Материалаас хайлт",
    text: "Хамааралтай хэсэг олдохгүй бол «материалд байхгүй» гэж шууд хэлнэ.",
    usesLlm: false,
  },
  {
    icon: Bot,
    title: "AI хариулт",
    text: "Шинэ асуултад л LLM багшийн материалд тулгуурлан хариулж, дараагийн удаад хадгална.",
    usesLlm: true,
  },
];

function StepCard({ step, index }: { step: Step; index: number }) {
  const { icon: Icon, title, text, usesLlm } = step;
  return (
    <div className="flex h-full flex-col rounded-2xl bg-background/80 p-5 backdrop-blur">
      <div className="flex items-center justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            usesLlm
              ? "bg-brand-gradient text-white shadow-lg shadow-violet-500/40"
              : "border border-primary/30 bg-primary-soft text-primary-soft-foreground"
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="font-mono text-sm text-muted">0{index + 1}</span>
      </div>
      <p className="mt-4 font-medium">{title}</p>
      <p className="mt-1 flex-1 text-sm text-muted">{text}</p>
      <span
        className={`mt-4 w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${
          usesLlm ? "bg-primary-soft text-primary-soft-foreground" : "bg-success-soft text-success"
        }`}
      >
        {usesLlm ? "LLM дуудна" : "LLM шаардлагагүй"}
      </span>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section id="how" className="relative isolate scroll-mt-16 overflow-hidden px-4 py-24">
      <div
        aria-hidden
        className="absolute top-1/2 left-1/2 -z-10 h-[400px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/15 blur-[140px]"
      />
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Хэрхэн ажилладаг"
          title="Ухаалаг хариултын урсгал"
          description="Асуулт бүрийг хамгийн хурдан, хямд аргаар хариулна. Том хэлний загварыг (LLM) зөвхөн шинэ асуултад ашигладаг тул хурдан бөгөөд зардал бага."
        />

        <ol className="relative mt-14 grid gap-4 md:grid-cols-5">
          {/* Line connecting the steps (desktop) */}
          <div
            aria-hidden
            className="absolute top-10 right-[10%] left-[10%] hidden h-px bg-linear-to-r from-transparent via-primary/50 to-accent/60 md:block"
          />
          {steps.map((step, index) => (
            <li
              key={step.title}
              className={`relative rounded-2xl p-px ${
                step.usesLlm ? "bg-brand-gradient" : "bg-border"
              }`}
            >
              <StepCard step={step} index={index} />
            </li>
          ))}
        </ol>

        <p className="mt-10 text-center text-sm text-muted">
          Хариулт бүрийн эх сурвалжийг (файл, хуудас) систем өөрөө хавсаргадаг тул зохиомол эх
          сурвалж гарахгүй.
        </p>
      </div>
    </section>
  );
}
