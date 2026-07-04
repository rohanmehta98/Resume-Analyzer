# ResumeIQ — AI Resume Analyzer

A modern, production-ready resume analyzer built with **Next.js 16 (App Router)**, **Tailwind v4 + shadcn/ui**, and the **Vercel AI SDK v7** running on **Groq**.

Upload a resume (PDF/DOCX/TXT) or paste text to get:

- **Overall + ATS + job-match scores** with a section-by-section breakdown
- **Potential score** — the score you'd reach after applying the top fixes
- **Keyword matching** against a pasted job description
- **Specific bullet rewrites** (before → after) and prioritized recommendations
- **Likely interview questions** and recruiter **red flags**
- A **streaming chat assistant** grounded in the actual resume text
- **Download the report as a PDF** (print-optimized)
- **"Try a sample"** one-click demo — no resume needed

Files are processed **in memory only** — nothing is stored.

## How it works

Two layers keep results trustworthy, not just "AI vibes":

1. **Deterministic layer** ([lib/signals.ts](lib/signals.ts), [lib/extract.ts](lib/extract.ts)) — plain code extracts the text (PDF via `unpdf`, DOCX via `mammoth`) and computes reproducible signals: contact info, sections present, word count, bullet & quantification ratios, action-verb usage, buzzwords, and ATS checks.
2. **AI layer** ([lib/prompt.ts](lib/prompt.ts) + Groq) — the model does the qualitative judgment (scoring, strengths/weaknesses, keyword analysis, rewrites) via `generateObject` with a **Zod schema** ([lib/schema.ts](lib/schema.ts)), so the output shape is guaranteed. Section scores are explicitly bound to the deterministic signals, and the verdict is derived from the score in code so they can never disagree.

## Quick start

```bash
npm install

# Configure your (free) Groq key
cp .env.example .env.local
# then edit .env.local and paste your key from https://console.groq.com/keys

npm run dev
# → http://localhost:3000
```

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest (deterministic core: signals, extract, format, clamp, rate-limit)
```

## Environment variables

| Variable       | Required | Default                             | Notes |
| -------------- | -------- | ----------------------------------- | ----- |
| `GROQ_API_KEY` | yes      | —                                   | Free key: https://console.groq.com/keys |
| `GROQ_MODEL`   | no       | `meta-llama/llama-4-scout-17b-16e-instruct` | Fast (~2.5s) + reliable. **Must support structured output (json_schema).** For deeper (but slower) analysis try `openai/gpt-oss-120b`. Do not use `llama-3.3-70b-versatile`. |

## Project structure

```
app/
  page.tsx              Landing + results (header/footer shell)
  layout.tsx            Theme provider, tooltip provider, toaster, fonts
  api/
    analyze/route.ts    POST — extract, compute signals, generateObject
    chat/route.ts       POST — streaming chat (streamText) grounded in the resume
    health/route.ts     GET  — config/status probe
components/
  analyzer.tsx          Client orchestrator (input → loading → results)
  upload-form.tsx       Dropzone / paste tabs + role + job description
  results-dashboard.tsx Scores, sections, keywords, rewrites, ATS, stats
  chat-panel.tsx        useChat streaming assistant
  score-ring.tsx        SVG donut
  ui/                   shadcn/ui components
lib/
  groq.ts               Model config
  schema.ts             Zod schema for the AI analysis
  analysis.ts           clampAnalysis — score clamping/normalization
  signals.ts            Deterministic signal + ATS computation
  extract.ts            PDF/DOCX/TXT text extraction
  prompt.ts             Prompt construction
  format.ts             Score → color/verdict helpers
  rate-limit.ts         In-memory per-IP rate limiter
  constants.ts          Shared size/length limits
tests/                  Vitest unit tests for the deterministic core
```

## Deploy to Vercel

Push to a Git repo, import it in Vercel, and set `GROQ_API_KEY` (and optionally `GROQ_MODEL`) in the project's Environment Variables. The App Router API routes deploy as functions automatically.

```bash
vercel            # preview
vercel --prod     # production
```

## Production hardening (before a real client)

Per-request abuse is already handled: server-side length caps on the file,
pasted text, job description, and chat context; scores clamped in code; input
bounded so signal computation can't be a CPU DoS; and a **best-effort in-memory
rate limiter** ([lib/rate-limit.ts](lib/rate-limit.ts)) on `/api/analyze`
(15/min/IP) and `/api/chat` (30/min/IP).

Two things to upgrade when this goes in front of real users, since the AI routes
are public and unauthenticated:

- **Shared rate limiting** — the in-memory limiter is per-function-instance and resets on cold start. For reliable limits across instances use [Vercel Firewall](https://vercel.com/docs/security/vercel-firewall) rate rules or `@upstash/ratelimit` (drop-in replacement for `rateLimit()`).
- **Auth** — gate the routes behind a session/API key once you have accounts.

## Swapping the AI provider

The app talks to Groq through the AI SDK. To move to another provider (OpenAI, Anthropic, Vercel AI Gateway, a paid tier), change the model in [lib/groq.ts](lib/groq.ts) — the rest of the app is provider-agnostic.
