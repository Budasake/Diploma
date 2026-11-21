"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { LoaderCircle, MessageSquarePlus, SendHorizontal, Sparkles, Trash2 } from "lucide-react";
import MessageBubble from "@/components/chat/MessageBubble";
import FormAlert from "@/components/auth/FormAlert";
import { NETWORK_ERROR, errorMessageFrom } from "@/lib/api-errors";
import type { ChatMessage, Conversation, ConversationDetail, Route } from "@/lib/types";

const EXAMPLES = ["Энэ хичээл юуг судалдаг вэ?", "Ирц хэдэн оноотой вэ?", "Хийсвэр машин гэж юу вэ?"];

type Draft = { content: string; route: Route | null };

/**
 * The course chat. Sends the question to POST /api/courses/{id}/chat and reads the
 * answer as a stream of Server-Sent Events (meta → route → delta… → done), so the
 * text appears while the AI is still writing.
 */
export default function Chat({
  courseId,
  basePath,
  conversations: initialConversations,
  initial,
}: {
  courseId: number;
  basePath: string; // e.g. /student/courses/3 — citations link to {basePath}/materials/…
  conversations: Conversation[];
  initial: ConversationDetail | null;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [conversationId, setConversationId] = useState<number | null>(initial?.id ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>(initial?.messages ?? []);
  const [draft, setDraft] = useState<Draft | null>(null); // the answer being streamed
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = draft !== null;

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, draft?.content]);

  function openConversation(id: number | null) {
    window.history.replaceState(null, "", id ? `?c=${id}` : "?");
  }

  async function load(id: number) {
    setError(null);
    const res = await fetch(`/api/courses/${courseId}/conversations/${id}`);
    if (!res.ok) return setError(await errorMessageFrom(res));
    const detail = (await res.json()) as ConversationDetail;
    setConversationId(detail.id);
    setMessages(detail.messages);
    openConversation(detail.id);
  }

  function newConversation() {
    setConversationId(null);
    setMessages([]);
    setError(null);
    openConversation(null);
  }

  async function remove(c: Conversation) {
    if (!confirm(`«${c.title}» яриаг устгах уу?`)) return;
    const res = await fetch(`/api/courses/${courseId}/conversations/${c.id}`, { method: "DELETE" });
    if (!res.ok) return setError(await errorMessageFrom(res));
    setConversations((list) => list.filter((x) => x.id !== c.id));
    if (c.id === conversationId) newConversation();
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setError(null);
    setInput("");
    const tempId = -Date.now();
    setMessages((m) => [
      ...m,
      { id: tempId, role: "user", content: question, route: null, citations: null, created_at: new Date().toISOString() },
    ]);
    setDraft({ content: "", route: null });

    try {
      const res = await fetch(`/api/courses/${courseId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, conversation_id: conversationId }),
      });
      if (!res.ok || !res.body) {
        setError(await errorMessageFrom(res));
        setMessages((m) => m.filter((x) => x.id !== tempId));
        setInput(question);
        return;
      }

      // Read the event stream: blocks separated by a blank line, "event:" + "data:".
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let content = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let end;
        while ((end = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const event = block.match(/^event: (.*)$/m)?.[1];
          const data = JSON.parse(block.match(/^data: (.*)$/m)?.[1] ?? "{}");
          if (event === "meta" && conversationId === null) {
            setConversationId(data.conversation_id);
            openConversation(data.conversation_id);
            setConversations((list) => [
              { id: data.conversation_id, title: question.slice(0, 120), created_at: "", updated_at: "" },
              ...list,
            ]);
          } else if (event === "route") {
            setDraft((d) => ({ content: d?.content ?? "", route: data.route }));
          } else if (event === "delta") {
            content += data.text;
            setDraft((d) => ({ route: d?.route ?? null, content }));
          } else if (event === "done") {
            setMessages((m) => [...m, data.message as ChatMessage]);
          }
        }
      }
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setDraft(null);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter makes a new line.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]">
      {/* Conversation list */}
      <aside className="hidden min-w-0 lg:block">
        <button
          type="button"
          onClick={newConversation}
          className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-surface-2"
        >
          <MessageSquarePlus className="h-4 w-4" /> Шинэ яриа
        </button>
        <ul className="mt-3 space-y-1">
          {conversations.map((c) => (
            <li key={c.id} className="group flex items-center">
              <button
                type="button"
                onClick={() => load(c.id)}
                className={`min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-sm ${
                  c.id === conversationId ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2/60"
                }`}
              >
                {c.title}
              </button>
              <button
                type="button"
                onClick={() => remove(c)}
                aria-label={`«${c.title}» яриаг устгах`}
                className="rounded-lg p-1.5 text-muted opacity-0 group-hover:opacity-100 hover:text-red-300 focus:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Messages + input */}
      {/* Inline height: Tailwind did not generate arbitrary vh classes here (see CLAUDE.md). */}
      <section style={{ height: "calc(100dvh - 14rem)", minHeight: "28rem" }} className="glass flex min-w-0 flex-col rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 lg:hidden">
          <span className="text-sm text-muted">{conversationId ? "Яриа" : "Шинэ яриа"}</span>
          <button type="button" onClick={newConversation} className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
            <MessageSquarePlus className="h-4 w-4" /> Шинэ
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          {messages.length === 0 && !busy && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white">
                <Sparkles className="h-6 w-6" />
              </span>
              <p className="mt-4 font-medium">Хичээлийн материалаас асуугаарай</p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                Хариулт бүр хаанаас авсныг (файл, хуудас) харуулна. Материалд байхгүй зүйлийг зохиохгүй.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="rounded-full border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} basePath={basePath} />
          ))}
          {draft &&
            (draft.content ? (
              <MessageBubble
                message={{ role: "assistant", content: draft.content, route: draft.route, citations: null }}
                basePath={basePath}
                streaming
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                {draft.route === "llm" ? "Материалаас хайж, хариулт бичиж байна…" : "Хайж байна…"}
              </div>
            ))}
          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="px-4 pb-2">
            <FormAlert message={error} />
          </div>
        )}

        <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-border p-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={2000}
            placeholder="Асуултаа бичнэ үү…"
            aria-label="Асуулт"
            className="max-h-40 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-border bg-surface px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Илгээх"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
          </button>
        </form>
      </section>
    </div>
  );
}
