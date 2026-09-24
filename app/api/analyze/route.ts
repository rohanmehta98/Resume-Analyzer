import { NextResponse } from "next/server";
import { generateObject } from "ai";
import type { z } from "zod";

import {
  FALLBACK_MODELS,
  FAST_MODEL_ID,
  MODEL_ID,
  groqOptions,
  isConfigured,
  isModelUnavailable,
  modelFor,
  retryAfterFromError,
} from "@/lib/groq";
import { extractText, ExtractionError, MAX_FILE_BYTES } from "@/lib/extract";
import { MAX_FILE_MB, MAX_JD_CHARS, MAX_ROLE_CHARS, MAX_TEXT_CHARS } from "@/lib/constants";
import { computeSignals, computeAtsChecks, appendKeywordCheck } from "@/lib/signals";
import { assessmentSchema, contentSchema } from "@/lib/schema";
import { buildAnalysis } from "@/lib/analysis";
import {
  CAREER_PROFILES,
  adjustWeightsForSeniority,
  detectCareerField,
  detectSeniority,
  isCareerFieldId,
} from "@/lib/careers";
import { ASSESSMENT_SYSTEM, CONTENT_SYSTEM, buildAssessmentPrompt, buildContentPrompt } from "@/lib/prompt";
import { verdictFromScore } from "@/lib/format";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { AnalyzeResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Hard ceiling on each AI attempt so a slow or stuck model can never hang the
// request until the platform kills the function at `maxDuration`. The two passes
// run in parallel, so two attempts × this budget stays under 60s with headroom
// for extraction.
const AI_ATTEMPT_TIMEOUT_MS = 24_000;
const AI_MAX_ATTEMPTS = 2;
// Longest provider-requested rate-limit wait we'll absorb inside one request.
const RATE_LIMIT_MAX_WAIT_S = 28;
// Includes the (low-effort) reasoning tokens of gpt-oss models.
const ASSESSMENT_MAX_TOKENS = 5000;
const CONTENT_MAX_TOKENS = 5000;

export async function POST(req: Request) {
  const started = Date.now();
  try {
    const rl = await checkRateLimit(`analyze:${getClientIp(req)}`, { limit: 10, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    if (!isConfigured()) {
      return err(
        "The AI service isn't configured. Add GROQ_API_KEY to your environment (free key at https://console.groq.com/keys).",
        503
      );
    }

    // Read multipart form (file) or plain fields (pasted text). Free-text fields
    // are length-capped server-side so they can't blow past request/CPU budgets.
    const form = await req.formData();
    const file = form.get("file");
    const pastedText = str(form.get("pastedText")).slice(0, MAX_TEXT_CHARS);
    const targetRole = str(form.get("targetRole")).slice(0, MAX_ROLE_CHARS);
    const jobDescription = str(form.get("jobDescription")).slice(0, MAX_JD_CHARS);
    const fieldOverride = str(form.get("careerField"));
    // Re-runs send the previously extracted text; keep the original file name for display.
    const sourceName = str(form.get("sourceName")).slice(0, 200);

    let buffer: Buffer | undefined;
    let fileName: string | undefined;
    if (file && typeof file === "object" && "arrayBuffer" in file) {
      const f = file as File;
      if (f.size > MAX_FILE_BYTES) {
        return err(`File is too large. Please upload a file under ${MAX_FILE_MB} MB.`, 413);
      }
      buffer = Buffer.from(await f.arrayBuffer());
      fileName = f.name;
    }

    // 1. Deterministic layer: extraction, signals, career field, seniority.
    const { text: resumeText, fileName: resolvedName, source } = await extractText({ buffer, fileName, pastedText });
    const signals = computeSignals(resumeText);
    let ats = computeAtsChecks(signals);

    const detected = detectCareerField({ resumeText, targetRole, jobDescription });
    const userChose = fieldOverride && isCareerFieldId(fieldOverride) && fieldOverride !== "general";
    const fieldId = userChose ? fieldOverride : detected.field;
    const profile = CAREER_PROFILES[fieldId];
    const seniority = detectSeniority({ resumeText, targetRole, yearsExperience: signals.timeline.yearsExperience });
    const weights = adjustWeightsForSeniority(profile.weights, seniority);

    // 2. AI layer: assessment + content in parallel. The assessment is required;
    //    the content pass is best-effort so a failure there still returns scores.
    const ctx = { resumeText, signals, profile, seniority, targetRole, jobDescription };
    const [assessRes, contentRes] = await Promise.allSettled([
      // Separate models = separate Groq per-model token budgets.
      generate(MODEL_ID, assessmentSchema, ASSESSMENT_SYSTEM, buildAssessmentPrompt(ctx), ASSESSMENT_MAX_TOKENS, 0.2),
      generate(FAST_MODEL_ID, contentSchema, CONTENT_SYSTEM, buildContentPrompt(ctx), CONTENT_MAX_TOKENS, 0.4),
    ]);
    if (assessRes.status === "rejected") throw assessRes.reason;
    if (contentRes.status === "rejected") {
      console.error("[analyze] content pass failed:", errLabel(contentRes.reason));
    }

    const hasJobDescription = Boolean(jobDescription);
    const analysis = buildAnalysis({
      assessment: assessRes.value,
      content: contentRes.status === "fulfilled" ? contentRes.value : null,
      resumeText,
      signals,
      weights,
      hasJobDescription,
    });

    // 3. Fold verified keyword coverage into ATS when a JD was provided.
    if (hasJobDescription) {
      ats = appendKeywordCheck(ats, analysis.keywords.matched.length, analysis.keywords.missing.length);
    }

    const response: AnalyzeResponse = {
      ok: true,
      analysis,
      verdict: verdictFromScore(analysis.overallScore),
      signals,
      ats,
      career: {
        field: profile.id,
        label: profile.label,
        seniority,
        confidence: userChose ? 1 : detected.confidence,
        weights,
        priorities: profile.priorities,
        expectsPortfolio: profile.expectsPortfolio,
      },
      hasJobDescription,
      input: { targetRole, jobDescription },
      resumeText,
      partial: contentRes.status === "rejected",
      meta: {
        model: `${MODEL_ID} + ${FAST_MODEL_ID}`,
        fileName: source === "paste" && sourceName ? sourceName : resolvedName,
        source,
        analyzedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
      },
    };
    return NextResponse.json(response);
  } catch (e) {
    return handleError(e);
  }
}

/** Run one structured generation under a strict time budget. Each attempt is
 *  capped by an abort timeout so a slow model can't hang the request; retries
 *  only cover schema drift. If the model has been retired on Groq, the next
 *  model in FALLBACK_MODELS is tried. Auth/rate/timeout errors fail fast. */
async function generate<T extends z.ZodType>(
  modelId: string,
  schema: T,
  system: string,
  prompt: string,
  maxOutputTokens: number,
  temperature: number
): Promise<z.infer<T>> {
  const candidates = [modelId, ...FALLBACK_MODELS.filter((m) => m !== modelId)];
  let lastErr: unknown;
  let waitedForRateLimit = false;
  for (const id of candidates) {
    for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt++) {
      try {
        const { object } = await generateObject({
          model: modelFor(id),
          schema,
          system,
          prompt,
          temperature,
          maxOutputTokens,
          maxRetries: 0, // retries are handled here, where we can tell error kinds apart
          abortSignal: AbortSignal.timeout(AI_ATTEMPT_TIMEOUT_MS),
          // Constrained decoding (strict json_schema). The schemas avoid the
          // min/max/minItems keywords Groq's strict mode rejects (lib/schema.ts).
          providerOptions: groqOptions(id, { strictJsonSchema: true }),
        });
        return object as z.infer<T>;
      } catch (e) {
        lastErr = e;
        // Free-tier token limits reset within a minute. If Groq asks for a short
        // wait, wait once and retry rather than failing the whole analysis.
        const wait = extractStatus(e) === 429 ? retryAfterFromError(e) : null;
        if (wait !== null && wait <= RATE_LIMIT_MAX_WAIT_S && !waitedForRateLimit) {
          waitedForRateLimit = true;
          await new Promise((r) => setTimeout(r, wait * 1000 + 250));
          attempt--; // this attempt didn't run — don't count it
          continue;
        }
        if (isModelUnavailable(e)) {
          console.error(`[analyze] model ${id} unavailable, trying fallback`);
          break; // next candidate model
        }
        if (attempt === AI_MAX_ATTEMPTS || !isSchemaError(e)) throw e;
      }
    }
  }
  throw lastErr;
}

function isSchemaError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  if (isAbortError(e)) return false; // a timeout is not schema drift — don't retry it
  const name = String((e as { name?: string }).name || "");
  const o = e as { message?: string; responseBody?: string };
  const msg = `${o.message ?? ""} ${o.responseBody ?? ""}`;
  return /NoObjectGenerated/i.test(name) || /validate JSON|did not match schema|does not match the expected schema|json_validate_failed|parse/i.test(msg);
}

/** True for abort/timeout errors (AbortSignal.timeout throws a TimeoutError). */
function isAbortError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const o = e as { name?: string; message?: string; cause?: { name?: string } };
  const blob = `${o.name ?? ""} ${o.message ?? ""} ${o.cause?.name ?? ""}`;
  return /abort|timeout|timed ?out/i.test(blob);
}

function handleError(e: unknown) {
  if (e instanceof ExtractionError) {
    return err(e.message, e.status);
  }
  if (isAbortError(e)) {
    return err("The analysis took too long and was stopped. Please try again — a shorter resume usually helps.", 504);
  }
  // AI SDK wraps retryable provider errors in a RetryError (no top-level
  // statusCode) — dig into lastError so 401/429 are mapped correctly.
  const status = extractStatus(e);
  if (status === 401) return err("The AI API key was rejected. Check GROQ_API_KEY.", 502);
  if (status === 429) {
    const wait = retryAfterFromError(e);
    return NextResponse.json(
      {
        error: wait
          ? `The AI usage limit was reached. Please try again in ${wait} seconds.`
          : "The AI usage limit was reached. Please wait a minute and try again.",
      },
      { status: 429, headers: { "Retry-After": String(wait ?? 60) } }
    );
  }
  if (status === 413) return err("That request was too large. Please upload a smaller file.", 413);
  if (status === 404 || isModelUnavailable(e)) {
    console.error("[analyze] no available model:", errLabel(e));
    return err("The configured AI model isn't available. Set GROQ_MODEL to a current Groq model (e.g. openai/gpt-oss-120b).", 502);
  }
  if (status === 400) {
    // Usually a rare structured-output validation miss from the provider.
    console.error("[analyze] provider rejected request:", errLabel(e));
    return err("The AI returned an incomplete result. Please try again.", 502);
  }

  // Log only a safe summary — the raw AI SDK error can serialize the provider
  // request body, which contains the candidate's resume text (PII).
  console.error("[analyze] error:", errLabel(e), "status=", status);
  return err("Something went wrong while analyzing. Please try again.", 500);
}

function extractStatus(e: unknown): number {
  if (!e || typeof e !== "object") return 0;
  const obj = e as Record<string, unknown>;
  if (typeof obj.statusCode === "number") return obj.statusCode;
  if (obj.lastError) return extractStatus(obj.lastError);
  if (Array.isArray(obj.errors) && obj.errors.length) return extractStatus(obj.errors[obj.errors.length - 1]);
  return 0;
}

function errLabel(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message.slice(0, 300)}` : String(e).slice(0, 300);
}

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}
