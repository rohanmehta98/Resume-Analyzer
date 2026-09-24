import { groq } from "@ai-sdk/groq";

/**
 * Model routing. Groq rate limits are per model (the free tier allows ~8k
 * tokens/minute on gpt-oss-120b), so work is split across two models:
 *
 *  - PRIMARY (`GROQ_MODEL`): the scoring/assessment pass and writing tools —
 *    the tasks where reasoning quality matters most.
 *  - FAST (`GROQ_FAST_MODEL`): the rewrites/interview-prep pass and chat.
 *
 * Both must support structured output (json_schema). If a configured model is
 * retired on Groq, calls fall back through FALLBACK_MODELS (see route).
 */
export const MODEL_ID = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
export const FAST_MODEL_ID = process.env.GROQ_FAST_MODEL?.trim() || "openai/gpt-oss-20b";

/** Tried in order when a model is unavailable (404 / decommissioned). */
export const FALLBACK_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

export const model = groq(MODEL_ID);
export const fastModel = groq(FAST_MODEL_ID);
export const modelFor = (id: string) => groq(id);

/** gpt-oss models are reasoning models; low effort keeps them fast and token-cheap. */
export function groqOptions(id: string, extra: Record<string, unknown> = {}) {
  return { groq: { ...(/gpt-oss|qwen3|deepseek-r1/i.test(id) ? { reasoningEffort: "low" } : {}), ...extra } };
}

/** Whether a usable API key is present (used by /api/health and route guards). */
export function isConfigured(): boolean {
  const key = process.env.GROQ_API_KEY;
  return Boolean(key && key.trim() && key !== "your_groq_api_key_here");
}

/** Seconds Groq asks us to wait, parsed from a 429 message ("try again in 18.96s" / "1m2.5s"). */
export function retryAfterFromError(e: unknown): number | null {
  const text = collectMessages(e);
  const m = text.match(/try again in (?:(\d+)m)?([\d.]+)s/i);
  if (!m) return null;
  return Math.ceil(Number(m[1] || 0) * 60 + Number(m[2]));
}

/** True when the provider says the model doesn't exist or was retired. */
export function isModelUnavailable(e: unknown): boolean {
  return /model_not_found|decommissioned|model[^.]{0,80}(does not exist|not found|no longer supported)/i.test(collectMessages(e));
}

function collectMessages(e: unknown, depth = 0): string {
  if (!e || typeof e !== "object" || depth > 4) return "";
  const o = e as Record<string, unknown>;
  const parts = [o.message, o.responseBody].filter((x) => typeof x === "string") as string[];
  if (o.lastError) parts.push(collectMessages(o.lastError, depth + 1));
  if (Array.isArray(o.errors)) for (const x of o.errors) parts.push(collectMessages(x, depth + 1));
  if (o.cause) parts.push(collectMessages(o.cause, depth + 1));
  return parts.join(" ");
}
