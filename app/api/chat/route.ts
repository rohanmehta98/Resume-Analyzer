import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";

import { model, isConfigured } from "@/lib/groq";
import { buildChatSystem } from "@/lib/prompt";
import {
  MAX_CHAT_CONTEXT_CHARS,
  MAX_CHAT_INPUT_CHARS,
  MAX_CHAT_MESSAGES,
  MAX_TEXT_CHARS,
} from "@/lib/constants";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Bound the answer length and wall-clock so a cheap request can't force a
// maximum-cost generation or hang the function (see the analyze route).
const CHAT_MAX_OUTPUT_TOKENS = 1500;
const CHAT_TIMEOUT_MS = 45_000;

interface ChatBody {
  messages: UIMessage[];
  resumeText?: string;
  context?: string;
}

export async function POST(req: Request) {
  const rl = await checkRateLimit(`chat:${getClientIp(req)}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(rl.retryAfterSec) },
    });
  }

  if (!isConfigured()) {
    return json({ error: "The AI assistant isn't configured. Add GROQ_API_KEY." }, 503);
  }

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const { messages, resumeText, context } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: "No message provided." }, 400);
  }
  if (!resumeText || !resumeText.trim()) {
    return json({ error: "Resume context is missing. Please analyze a resume first." }, 400);
  }
  // Cap total input size (not just message count) so one request can't send a
  // near-context-window payload and force the most expensive possible call.
  const recent = messages.slice(-MAX_CHAT_MESSAGES);
  if (totalTextLength(recent) > MAX_CHAT_INPUT_CHARS) {
    return json({ error: "That message is too long. Please shorten it and try again." }, 413);
  }

  try {
    const result = streamText({
      model,
      system: buildChatSystem(resumeText.slice(0, MAX_TEXT_CHARS), context?.slice(0, MAX_CHAT_CONTEXT_CHARS)),
      messages: await convertToModelMessages(recent),
      temperature: 0.5,
      maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
      abortSignal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
      // Provider errors that happen mid-stream don't throw here (the response has
      // already started) — surface them in logs instead of failing silently.
      onError: ({ error }) => console.error("[chat] stream error:", errLabel(error)),
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (e) {
    // Log only a safe summary — the raw error can carry the resume text (PII)
    // embedded in the provider request body.
    console.error("[chat] error:", errLabel(e));
    return json({ error: "Could not process the chat request. Please try again." }, 500);
  }
}

/** Combined length of all text parts across the messages. */
function totalTextLength(messages: UIMessage[]): number {
  let n = 0;
  for (const m of messages) {
    for (const p of (m.parts ?? []) as Array<{ type?: string; text?: string }>) {
      if (p?.type === "text" && typeof p.text === "string") n += p.text.length;
    }
  }
  return n;
}

/** Name + message only — never the full error object (which can hold PII). */
function errLabel(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
