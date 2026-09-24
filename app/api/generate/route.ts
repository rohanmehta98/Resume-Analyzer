import { createTextStreamResponse, streamText, toTextStream } from "ai";

import { MODEL_ID, model, groqOptions, isConfigured } from "@/lib/groq";
import {
  GENERATE_KINDS,
  GENERATE_SYSTEM,
  GENERATE_TONES,
  buildGeneratePrompt,
  type GenerateKind,
  type GenerateTone,
} from "@/lib/prompt";
import { MAX_JD_CHARS, MAX_ROLE_CHARS, MAX_TEXT_CHARS } from "@/lib/constants";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const GENERATE_MAX_OUTPUT_TOKENS = 2000; // includes low-effort reasoning tokens
const GENERATE_TIMEOUT_MS = 45_000;

interface GenerateBody {
  kind?: string;
  tone?: string;
  resumeText?: string;
  targetRole?: string;
  jobDescription?: string;
  company?: string;
}

export async function POST(req: Request) {
  const rl = await checkRateLimit(`generate:${getClientIp(req)}`, { limit: 12, windowMs: 60_000 });
  if (!rl.ok) {
    return json({ error: "Too many requests. Please wait a moment." }, 429, { "Retry-After": String(rl.retryAfterSec) });
  }
  if (!isConfigured()) {
    return json({ error: "The AI service isn't configured. Add GROQ_API_KEY." }, 503);
  }

  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const kind = String(body.kind || "") as GenerateKind;
  if (!GENERATE_KINDS.includes(kind)) return json({ error: "Unknown document type." }, 400);
  const tone = (GENERATE_TONES.includes(body.tone as GenerateTone) ? body.tone : "professional") as GenerateTone;
  const resumeText = String(body.resumeText || "").slice(0, MAX_TEXT_CHARS);
  if (resumeText.trim().length < 100) {
    return json({ error: "Resume context is missing. Please analyze a resume first." }, 400);
  }

  try {
    const result = streamText({
      model,
      providerOptions: groqOptions(MODEL_ID),
      system: GENERATE_SYSTEM,
      prompt: buildGeneratePrompt({
        kind,
        tone,
        resumeText,
        targetRole: String(body.targetRole || "").slice(0, MAX_ROLE_CHARS),
        jobDescription: String(body.jobDescription || "").slice(0, MAX_JD_CHARS),
        company: String(body.company || "").slice(0, 120),
      }),
      temperature: 0.6,
      maxOutputTokens: GENERATE_MAX_OUTPUT_TOKENS,
      abortSignal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
      onError: ({ error }) => console.error("[generate] stream error:", errLabel(error)),
    });
    return createTextStreamResponse({ stream: toTextStream({ stream: result.stream }) });
  } catch (e) {
    console.error("[generate] error:", errLabel(e));
    return json({ error: "Could not generate that document. Please try again." }, 500);
  }
}

function errLabel(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message.slice(0, 300)}` : String(e).slice(0, 300);
}

function json(payload: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
