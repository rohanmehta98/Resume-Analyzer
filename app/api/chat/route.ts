import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";

import { model, isConfigured } from "@/lib/groq";
import { buildChatSystem } from "@/lib/prompt";
import { MAX_CHAT_CONTEXT_CHARS, MAX_CHAT_MESSAGES, MAX_TEXT_CHARS } from "@/lib/constants";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatBody {
  messages: UIMessage[];
  resumeText?: string;
  context?: string;
}

export async function POST(req: Request) {
  const rl = rateLimit(`chat:${getClientIp(req)}`, 30, 60_000);
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

  try {
    const result = streamText({
      model,
      system: buildChatSystem(resumeText.slice(0, MAX_TEXT_CHARS), context?.slice(0, MAX_CHAT_CONTEXT_CHARS)),
      messages: await convertToModelMessages(messages.slice(-MAX_CHAT_MESSAGES)),
      temperature: 0.5,
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (e) {
    console.error("[chat] error:", e);
    return json({ error: "Could not process the chat request. Please try again." }, 500);
  }
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
