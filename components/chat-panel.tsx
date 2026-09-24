"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageSquare, RotateCcw, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "What's the single biggest thing holding this resume back?",
  "Rewrite my professional summary for this role",
  "Which bullets should I cut or merge?",
  "How do I explain my career gap or change?",
];

export function ChatPanel({
  resumeText,
  context,
  open,
  onOpenChange,
  seed,
  onSeedConsumed,
}: {
  resumeText: string;
  context?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A prompt another part of the dashboard wants sent (e.g. "practice this question"). */
  seed: string | null;
  onSeedConsumed: () => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // resumeText/context are stable for this component's lifetime — the parent
  // remounts the dashboard (key={analyzedAt}) on every new analysis.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({ body: { messages, resumeText, context } }),
      }),
    [resumeText, context]
  );

  const { messages, sendMessage, setMessages, status, error, stop } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";
  const last = messages[messages.length - 1];
  const assistantHasText = last?.role === "assistant" && last.parts.some((p) => p.type === "text" && p.text.length > 0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Deliver a seeded prompt once the panel is open and idle.
  useEffect(() => {
    if (!seed || !open || busy) return;
    sendMessage({ text: seed });
    onSeedConsumed();
  }, [seed, open, busy, sendMessage, onSeedConsumed]);

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  }

  if (!open) {
    return (
      <Button
        size="lg"
        className="fixed bottom-6 right-6 z-40 h-12 gap-2 rounded-full px-5 shadow-lg print:hidden"
        aria-label="Open career coach chat"
        onClick={() => onOpenChange(true)}
      >
        <MessageSquare className="h-5 w-5" />
        <span className="hidden sm:inline">Ask the coach</span>
      </Button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Career coach chat"
      onKeyDown={(e) => e.key === "Escape" && onOpenChange(false)}
      className="fixed inset-x-3 bottom-3 z-40 flex h-[min(620px,calc(100dvh-5rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl duration-200 animate-in fade-in-0 slide-in-from-bottom-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[420px] print:hidden"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Career coach</p>
          <p className="text-xs text-muted-foreground">Answers are grounded in your resume</p>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              aria-label="Clear conversation"
              onClick={() => {
                stop();
                setMessages([]);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Close chat" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <Bubble role="assistant">
              <p>Ask me anything about this resume — rewrites, positioning, gaps, or interview prep.</p>
            </Bubble>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-lg border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => {
          // Only the visible answer — reasoning-model "thinking" parts are hidden.
          const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          if (m.role !== "user" && !text) return null;
          return (
            <Bubble key={m.id} role={m.role === "user" ? "user" : "assistant"}>
              {m.role === "user" ? <p className="whitespace-pre-wrap">{text}</p> : <Markdown text={text} />}
            </Bubble>
          );
        })}
        {busy && !assistantHasText && (
          <Bubble role="assistant">
            <span className="inline-flex gap-1" aria-label="Thinking">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
            </span>
          </Bubble>
        )}
        {error && <p className="text-center text-xs text-destructive">Something went wrong. Please try again.</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t p-3"
      >
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Ask about your resume…"
          aria-label="Message the career coach"
          className="max-h-32 min-h-9 resize-none"
        />
        <Button type="submit" size="icon" aria-label="Send" disabled={busy || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "max-w-[88%] rounded-2xl px-3.5 py-2 text-sm",
        role === "user" ? "ml-auto rounded-br-sm bg-primary text-primary-foreground" : "mr-auto rounded-bl-sm bg-muted text-foreground"
      )}
    >
      {children}
    </div>
  );
}
