import type { LucideIcon } from "lucide-react";
import { Check, GraduationCap, ShieldCheck, Users } from "lucide-react";
import SectionHeading from "./SectionHeading";

type Role = { icon: LucideIcon; name: string; summary: string; abilities: string[] };

const roles: Role[] = [
  {
    icon: GraduationCap,
    name: "Оюутан",
    summary: "Суралцах, давтах, шалгалтад бэлдэх",
    abilities: ["AI туслахаас асуулт асуух", "Сорил өгөх", "Флэш картаар давтах", "Ахицаа харах"],
  },
  {
    icon: Users,
    name: "Багш",
    summary: "Хичээл бэлдэх, удирдах",
    abilities: [
      "Хичээл үүсгэх, оюутан бүртгэх",
      "Материал оруулах",
      "AI-ын бэлдсэн контентыг батлах",
      "Оюутны идэвхийг шинжлэх",
    ],
  },
  {
    icon: ShieldCheck,
    name: "Админ",
    summary: "Системийг хянах",
    abilities: ["Хэрэглэгч удирдах", "Эрх тохируулах", "AI ашиглалт хянах", "Системийн тохиргоо"],
  },
];

export default function Roles() {
  return (
    <section id="roles" className="scroll-mt-16 px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Хэрэглэгчид"
          title="Гурван төрлийн хэрэглэгч"
          description="Хэрэглэгч бүр өөрийн эрхэд тохирсон самбартай."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {roles.map(({ icon: Icon, name, summary, abilities }) => (
            <article
              key={name}
              className="glass rounded-3xl p-6 transition-transform duration-300 hover:-translate-y-1 hover:border-primary/40"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-lg shadow-violet-500/30">
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-xl font-semibold">{name}</h3>
              <p className="mt-1 text-sm text-muted">{summary}</p>
              <ul className="mt-5 space-y-2">
                {abilities.map((ability) => (
                  <li key={ability} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {ability}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
