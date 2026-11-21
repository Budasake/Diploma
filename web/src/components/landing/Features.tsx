import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  ChartColumn,
  ListChecks,
  MessageSquare,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";
import SectionHeading from "./SectionHeading";

type Feature = { icon: LucideIcon; title: string; text: string };

const studentFeatures: Feature[] = [
  {
    icon: MessageSquare,
    title: "Эх сурвалжтай хариулт",
    text: "Хариулт бүр аль лекцийн хэддүгээр хуудаснаас авсныг заана.",
  },
  {
    icon: ListChecks,
    title: "Сорил ба давтлага",
    text: "Багшийн баталсан тест, флэш карт ашиглан шалгалтдаа бэлдэнэ.",
  },
  {
    icon: BookOpen,
    title: "Лекцийн хураангуй",
    text: "Лекц бүрийн гол санаа, нэр томьёог товч хэлбэрээр уншина.",
  },
  {
    icon: TrendingUp,
    title: "Ахицаа хянах",
    text: "Аль сэдэв дээр сул байгаагаа сорилын дүнгээр харна.",
  },
];

const teacherFeatures: Feature[] = [
  {
    icon: Upload,
    title: "Материал оруулах",
    text: "PDF, DOCX файлаа оруулахад систем автоматаар боловсруулна.",
  },
  {
    icon: Sparkles,
    title: "AI-аар контент бэлдэх",
    text: "Хураангуй, сорилын асуултын ноорог автоматаар үүснэ. Таны баталсан нь л оюутанд харагдана.",
  },
  {
    icon: SlidersHorizontal,
    title: "AI-г тохируулах",
    text: "Даалгаврын хариуг шууд өгөхгүй байх зэрэг дүрмийг хичээл бүрт тогтооно.",
  },
  {
    icon: ChartColumn,
    title: "Оюутны идэвх",
    text: "Хамгийн их асуудаг асуулт, материалд дутуу байгаа сэдвийг харна.",
  },
];

function FeatureColumn({ title, features }: { title: string; features: Feature[] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
      <h3 className="text-xl font-semibold">{title}</h3>
      <ul className="mt-6 space-y-6">
        {features.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium">{title}</p>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Features() {
  return (
    <section id="features" className="scroll-mt-16 px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Боломжууд"
          title="Оюутан, багш хоёуланд нь"
          description="Нэг платформ дээр суралцах, заах ажлыг AI-аар дэмжинэ."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <FeatureColumn title="🎓 Оюутанд" features={studentFeatures} />
          <FeatureColumn title="👩‍🏫 Багшид" features={teacherFeatures} />
        </div>
      </div>
    </section>
  );
}
