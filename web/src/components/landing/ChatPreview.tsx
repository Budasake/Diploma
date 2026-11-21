"use client";

import { useEffect, useState } from "react";
import { Bot, Database, FileText, CircleHelp, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Animated example chat for the landing page (no real AI call).
 * Cycles through examples that show the different answer routes:
 * teacher FAQ, saved (cached) answer and a new AI answer.
 */
type Example = {
  question: string;
  answer: string;
  source: string;
  route: string;
  routeIcon: LucideIcon;
  usesLlm: boolean;
  time: string;
};

const examples: Example[] = [
  {
    question: "Энэ хичээл хэдэн кредит вэ?",
    answer: "Программчлалын үндсэн аргууд хичээл нь 3 кредиттэй, бакалаврын заавал судлах хичээл юм.",
    source: "F_CSM101_QAQ.docx",
    route: "Багшийн FAQ",
    routeIcon: CircleHelp,
    usesLlm: false,
    time: "0.02 сек",
  },
  {
    question: "Санах ойн менежмент гэж юу вэ?",
    answer:
      "Санах ойн менежмент нь программ ажиллах үед санах ойг хуваарилах, чөлөөлөх, хянах үйл явц юм. Үүнд stack болон heap санах ой багтана.",
    source: "Memory Management Lecture 5.pdf, хуудас 3",
    route: "AI хариулт",
    routeIcon: Bot,
    usesLlm: true,
    time: "2.1 сек",
  },
  {
    question: "Функциональ программчлал гэж юу вэ?",
    answer:
      "Функциональ программчлал нь тооцооллыг математик функцийн үнэлгээ хэлбэрээр илэрхийлдэг, төлөв өөрчлөхөөс зайлсхийдэг арга юм.",
    source: "Functional Programming Paradigms.pdf, хуудас 2",
    route: "Хадгалсан хариулт",
    routeIcon: Database,
    usesLlm: false,
    time: "0.05 сек",
  },
];

type Phase = "question" | "thinking" | "answering" | "done";

const CHARS_PER_TICK = 2;
const TICK_MS = 22;

export default function ChatPreview() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("question");
  const [typed, setTyped] = useState(0);

  const example = examples[index];

  // Each example runs on a timeline: question → thinking → typing → done → next.
  useEffect(() => {
    const length = examples[index].answer.length;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let interval: ReturnType<typeof setInterval> | undefined;

    const startTyping = 1500;
    const typingTime = reduceMotion ? 0 : Math.ceil(length / CHARS_PER_TICK) * TICK_MS;
    const doneAt = startTyping + typingTime;

    timers.push(setTimeout(() => setPhase("thinking"), 600));
    timers.push(
      setTimeout(() => {
        if (reduceMotion) {
          setTyped(length);
          return;
        }
        setPhase("answering");
        interval = setInterval(() => setTyped((t) => Math.min(t + CHARS_PER_TICK, length)), TICK_MS);
      }, startTyping),
    );
    timers.push(
      setTimeout(() => {
        clearInterval(interval);
        setTyped(length);
        setPhase("done");
      }, doneAt),
    );
    timers.push(
      setTimeout(() => {
        setPhase("question");
        setTyped(0);
        setIndex((i) => (i + 1) % examples.length);
      }, doneAt + 4000),
    );

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, [index]);

  const RouteIcon = example.routeIcon;
  const showAnswer = phase === "answering" || phase === "done";

  return (
    <div className="relative">
      {/* Glow behind the card */}
      <div aria-hidden className="absolute -inset-4 rounded-3xl bg-brand-gradient opacity-25 blur-2xl" />

      <div className="glass relative rounded-2xl p-5 shadow-2xl">
        {/* Window bar */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-3 w-3 rounded-full bg-white/15" />
            <span className="h-3 w-3 rounded-full bg-white/15" />
            <span className="h-3 w-3 rounded-full bg-white/15" />
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Sparkles className="h-3.5 w-3.5 text-primary-soft-foreground" />
            AI Туслах
          </span>
        </div>

        <p className="sr-only">
          Жишээ чат: оюутан асуулт асууж, багшийн материалаас эх сурвалжтай хариулт авч байна.
        </p>

        <div aria-hidden className="flex min-h-[290px] flex-col gap-4">
          {/* Student question */}
          <div
            key={`q-${index}`}
            className="animate-fade-in ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-brand-gradient px-4 py-2.5 text-sm text-white"
          >
            {example.question}
          </div>

          {/* Thinking dots */}
          {phase === "thinking" && (
            <div className="animate-fade-in flex w-fit gap-1.5 rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-3.5">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-2 w-2 animate-bounce rounded-full bg-primary-soft-foreground"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          )}

          {/* Answer being typed */}
          {showAnswer && (
            <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-border bg-surface-2 px-4 py-3 text-sm leading-relaxed">
              {example.answer.slice(0, typed)}
              {phase === "answering" && (
                <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-blink bg-accent" />
              )}
              {phase === "done" && (
                <div className="animate-fade-in mt-3 flex items-center gap-1.5 border-t border-border pt-2 text-xs text-muted">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  {example.source}
                </div>
              )}
            </div>
          )}

          {/* Which route answered */}
          {phase === "done" && (
            <div
              className={`animate-fade-in inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                example.usesLlm ? "bg-primary-soft text-primary-soft-foreground" : "bg-success-soft text-success"
              }`}
            >
              <RouteIcon className="h-3.5 w-3.5" />
              {example.route} · {example.usesLlm ? "LLM" : "LLM-гүй"} · {example.time}
            </div>
          )}
        </div>

        {/* Progress dots */}
        <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
          {examples.map((e, i) => (
            <span
              key={e.question}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === index ? "w-6 bg-primary" : "w-1.5 bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
