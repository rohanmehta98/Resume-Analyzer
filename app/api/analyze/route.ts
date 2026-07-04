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
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import type { AnalyzeResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const rl = rateLimit(`analyze:${getClientIp(req)}`, 15, 60_000);
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

/** Run the structured analysis, retrying when the model returns a non-conforming
 *  object (intermittent with reasoning models). Fails fast on auth/rate errors. */
async function generateAnalysis(prompt: string) {
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { object } = await generateObject({
        model,
        schema: analysisSchema,
        system: ANALYSIS_SYSTEM,
        prompt,
        temperature: 0.2, // lower = more consistent scores across runs
        providerOptions: { groq: { strictJsonSchema: false } },
      });
      return object;
    } catch (e) {
      lastErr = e;
      if (attempt === MAX_ATTEMPTS || !isSchemaError(e)) throw e;
    }
  }
  throw lastErr;
}

function isSchemaError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const name = String((e as { name?: string }).name || "");
  const msg = String((e as { message?: string }).message || "");
  return /NoObjectGenerated/i.test(name) || /validate JSON|did not match schema/i.test(msg);
}

function handleError(e: unknown) {
  if (e instanceof ExtractionError) {
    return err(e.message, e.status);
  }
  // AI SDK wraps retryable provider errors in a RetryError (no top-level
  // statusCode) — dig into lastError so 401/429 are mapped correctly.
  const status = extractStatus(e);
  if (status === 401) return err("The AI API key was rejected. Check GROQ_API_KEY.", 502);
  if (status === 429) return err("The AI service is rate-limited right now. Please wait a moment and retry.", 429);
  if (status === 413) return err("That request was too large. Please upload a smaller file.", 413);

  console.error("[analyze] error:", e);
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
