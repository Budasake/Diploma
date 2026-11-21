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

export default function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-16 bg-surface px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Хэрхэн ажилладаг"
          title="Ухаалаг хариултын урсгал"
          description="Асуулт бүрийг хамгийн хурдан, хямд аргаар хариулна. Том хэлний загварыг (LLM) зөвхөн шинэ асуултад ашигладаг тул хурдан бөгөөд зардал бага."
        />

        <ol className="mt-12 grid gap-4 md:grid-cols-5">
          {steps.map(({ icon: Icon, title, text, usesLlm }, index) => (
            <li key={title} className="relative flex flex-col rounded-2xl border border-border bg-background p-5">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold text-muted">{index + 1}</span>
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
            </li>
          ))}
        </ol>

        <p className="mt-8 text-center text-sm text-muted">
          Хариулт бүрийн эх сурвалжийг (файл, хуудас) систем өөрөө хавсаргадаг тул зохиомол эх
          сурвалж гарахгүй.
        </p>
      </div>
    </section>
  );
}
