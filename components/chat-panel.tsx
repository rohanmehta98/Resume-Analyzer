"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageSquare, X, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ChatPanel({ resumeText, weaknesses }: { resumeText: string; weaknesses: string[] }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // resumeText/weaknesses are stable for this component's lifetime — the parent
  // remounts ChatPanel (key={analyzedAt}) on every new analysis — so it's safe to
  // capture them directly in the transport rather than threading a ref.
  const context = weaknesses.length ? `Known weaknesses from analysis: ${weaknesses.slice(0, 4).join("; ")}.` : undefined;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({ body: { messages, resumeText, context } }),
      }),
    [resumeText, context]
  );

  const { messages, sendMessage, status, error } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";
  // True once the streaming assistant answer has produced visible text (vs. only
  // hidden reasoning) — used to keep "Thinking…" up until the answer starts.
  const last = messages[messages.length - 1];
  const assistantHasText =
    last?.role === "assistant" && last.parts.some((p) => p.type === "text" && p.text.length > 0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  }

  if (!open) {
    return (
      <Button
        size="lg"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full p-0 shadow-lg print:hidden"
        aria-label="Open resume assistant"
        onClick={() => setOpen(true)}
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Resume assistant chat"
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      className="fixed bottom-6 right-6 z-40 flex h-[min(560px,calc(100vh-100px))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl print:hidden"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Resume assistant</p>
          <p className="text-xs text-muted-foreground">Ask about improving your resume</p>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Close chat" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div ref={scrollRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-4">
        <Bubble role="assistant">
          Analysis done. Ask me anything — e.g. “rewrite my summary” or “what&apos;s my biggest weakness?”
        </Bubble>
        {messages.map((m) => {
          // Only the visible answer — reasoning-model "thinking" parts are hidden.
          const text = m.parts
            .filter((p) => p.type === "text")
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("");
          if (m.role !== "user" && !text) return null;
          return (
            <Bubble key={m.id} role={m.role === "user" ? "user" : "assistant"}>
              {text}
            </Bubble>
          );
        })}
        {busy && !assistantHasText && (
          <Bubble role="assistant">
            <span className="opacity-60">Thinking…</span>
          </Bubble>
        )}
        {error && <p className="text-center text-xs text-destructive">Something went wrong. Please try again.</p>}
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t p-3">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          aria-label="Message the resume assistant"
          autoComplete="off"
          disabled={busy}
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
        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
        role === "user"
          ? "ml-auto rounded-br-sm bg-primary text-primary-foreground"
          : "mr-auto rounded-bl-sm bg-muted text-foreground"
      )}
    >
      {children}
    </div>
  );
}
