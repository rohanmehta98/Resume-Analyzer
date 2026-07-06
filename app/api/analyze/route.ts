import { NextResponse } from "next/server";
import { generateObject } from "ai";

import { model, MODEL_ID, isConfigured } from "@/lib/groq";
import { extractText, ExtractionError, MAX_FILE_BYTES } from "@/lib/extract";
import { MAX_FILE_MB, MAX_JD_CHARS, MAX_ROLE_CHARS, MAX_TEXT_CHARS } from "@/lib/constants";
import { computeSignals, computeAtsChecks, appendKeywordCheck } from "@/lib/signals";
import { analysisSchema } from "@/lib/schema";
import { clampAnalysis } from "@/lib/analysis";
import { ANALYSIS_SYSTEM, buildAnalysisPrompt } from "@/lib/prompt";
import { verdictFromScore } from "@/lib/format";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { AnalyzeResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Hard ceiling on each AI attempt so a slow or stuck model can never hang the
// request until the platform kills the function at `maxDuration`. Two attempts ×
// this budget stays comfortably under 60s, leaving headroom for extraction.
const AI_ATTEMPT_TIMEOUT_MS = 24_000;
const AI_MAX_ATTEMPTS = 2;
const AI_MAX_OUTPUT_TOKENS = 4000;

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(`analyze:${getClientIp(req)}`, { limit: 15, windowMs: 60_000 });
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

    // 1. Deterministic extraction + signals.
    const { text: resumeText, fileName: resolvedName, source } = await extractText({
      buffer,
      fileName,
      pastedText,
    });
    const signals = computeSignals(resumeText);
    let ats = computeAtsChecks(signals);

    // 2. Qualitative analysis (AI, schema-constrained). Reasoning models
    //    occasionally emit a non-conforming object, so retry a couple of times
    //    before surfacing an error; scores/priority are normalized afterwards.
    const prompt = buildAnalysisPrompt({ resumeText, signals, targetRole, jobDescription });
    const analysis = clampAnalysis(await generateAnalysis(prompt));

    // 3. Fold keyword coverage into ATS when a JD was provided.
    const hasJobDescription = Boolean(jobDescription && jobDescription.trim());
    if (hasJobDescription) {
      ats = appendKeywordCheck(ats, analysis.keywords.matched.length, analysis.keywords.missing.length);
    }

    const response: AnalyzeResponse = {
      ok: true,
      analysis,
      verdict: verdictFromScore(analysis.overallScore),
      signals,
      ats,
      hasJobDescription,
      resumeText,
      meta: {
        model: MODEL_ID,
        fileName: resolvedName,
        source,
        analyzedAt: new Date().toISOString(),
      },
    };
    return NextResponse.json(response);
  } catch (e) {
    return handleError(e);
  }
}

/** Run the structured analysis under a strict time budget. Each attempt is
 *  capped by an abort timeout so a slow model can't hang the request; retries
 *  only cover the rare schema drift. Fails fast on auth/rate/timeout errors. */
async function generateAnalysis(prompt: string) {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt++) {
    try {
      const { object } = await generateObject({
        model,
        schema: analysisSchema,
        system: ANALYSIS_SYSTEM,
        prompt,
        temperature: 0.2, // lower = more consistent scores across runs
        maxOutputTokens: AI_MAX_OUTPUT_TOKENS, // bound generation so a verbose resume can't run away
        maxRetries: 1, // one transient-error retry, inside the per-attempt timeout below
        abortSignal: AbortSignal.timeout(AI_ATTEMPT_TIMEOUT_MS),
        // Constrained decoding (strict json_schema) makes Groq guarantee output
        // that matches the schema, so we don't burn slow retries on the model
        // drifting off-shape. The schema deliberately avoids the min/max/minItems
        // keywords Groq's strict mode rejects (see lib/schema.ts).
        providerOptions: { groq: { strictJsonSchema: true } },
      });
      return object;
    } catch (e) {
      lastErr = e;
      // Retry only on schema drift (rare with strict decoding). Auth, rate-limit,
      // and timeout errors fail fast so the user gets a clear message quickly
      // instead of waiting out the whole budget.
      if (attempt === AI_MAX_ATTEMPTS || !isSchemaError(e)) throw e;
    }
  }
  throw lastErr;
}

function isSchemaError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  if (isAbortError(e)) return false; // a timeout is not schema drift — don't retry it
  const name = String((e as { name?: string }).name || "");
  const msg = String((e as { message?: string }).message || "");
  return /NoObjectGenerated/i.test(name) || /validate JSON|did not match schema/i.test(msg);
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
  // A model call that blew past its per-attempt budget was aborted — return a
  // clear timeout instead of a generic 500 (or, before the abort existed, a hang).
  if (isAbortError(e)) {
    return err(
      "The analysis took too long and was stopped. Please try again — a shorter resume, or switching to the default (faster) model, usually fixes this.",
      504
    );
  }
  // AI SDK wraps retryable provider errors in a RetryError (no top-level
  // statusCode) — dig into lastError so 401/429 are mapped correctly.
  const status = extractStatus(e);
  if (status === 401) return err("The AI API key was rejected. Check GROQ_API_KEY.", 502);
  if (status === 429) return err("The AI service is rate-limited right now. Please wait a moment and retry.", 429);
  if (status === 413) return err("That request was too large. Please upload a smaller file.", 413);

  // Log only a safe summary — the raw AI SDK error can serialize the provider
  // request body, which contains the candidate's resume text (PII).
  console.error("[analyze] error:", e instanceof Error ? `${e.name}: ${e.message}` : String(e), "status=", status);
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

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}
