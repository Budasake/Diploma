import { GraduationCap } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border px-4 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-sm text-muted md:flex-row">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <GraduationCap className="h-5 w-5 text-primary" />
          AI Сургалтын Туслах
        </div>
        <p>ШУТИС · Мэдээлэл, Холбооны Технологийн Сургууль · Дипломын ажил 2026</p>
      </div>
    </footer>
  );
}
