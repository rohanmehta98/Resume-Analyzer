import { groq } from "@ai-sdk/groq";

/**
 * Default model. `openai/gpt-oss-120b` is a strong, widely-available Groq model
 * that supports the structured-output (json_schema) mode `generateObject` needs.
 * A faster alternative is `meta-llama/llama-4-scout-17b-16e-instruct`.
 *
 * Note: `llama-3.3-70b-versatile` does NOT support json_schema structured output,
 * so `generateObject` fails with it. If you change GROQ_MODEL, pick a model with
 * "Object Generation" support (see .env.example).
 */
export const MODEL_ID = process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

export const model = groq(MODEL_ID);

/** Whether a usable API key is present (used by /api/health and route guards). */
export function isConfigured(): boolean {
  const key = process.env.GROQ_API_KEY;
  return Boolean(key && key.trim() && key !== "your_groq_api_key_here");
}
