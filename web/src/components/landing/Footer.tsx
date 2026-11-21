import { Sparkles } from "lucide-react";
import SystemStatus from "@/components/SystemStatus";

export default function Footer() {
  return (
    <footer className="border-t border-border px-4 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-sm text-muted md:flex-row">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-gradient">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </span>
          AI Сургалтын Туслах
        </div>
        <SystemStatus />
        <p className="text-center">ШУТИС · МХТС · Дипломын ажил 2026</p>
      </div>
    </footer>
  );
}
