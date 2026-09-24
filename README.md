# ResumeIQ — AI Resume Analyzer

A resume analyzer that works for **any career**: it judges each resume by the standards of the candidate's own field and seniority (a nurse on licensure and patient load, a salesperson on quota attainment, an engineer on systems and scale), not a one-size-fits-all rubric.

Built with **Next.js 16 (App Router)**, **React 19**, **Tailwind v4 + shadcn/ui**, and the **Vercel AI SDK v7** on **Groq**.

## Features

Upload a resume (PDF, DOCX, TXT) or paste text, optionally with a target role and job description.

- **Calibrated overall score**, weighted by career field and seniority, with a "how it's scored" breakdown
- **Six section scores** — experience, impact, skills, role relevance, clarity, education & credentials
- **Job match** — requirement-by-requirement status (met / partial / missing, with evidence) and verified keyword coverage
- **ATS checks** — parseability, contact info, standard sections, dated history, length, bullets, quantification, voice
- **Career timeline** — total experience, average tenure, employment gaps, and short stints parsed from dates
- **Action plan** — prioritized fixes you can check off, with progress saved in the browser
- **Improve** — rewritten headline and summary, bullet rewrites (with `[X]` placeholders instead of invented numbers), and writing-quality metrics
- **Interview prep** — likely questions with what they probe and how to answer from your own experience
- **Writing tools** — streamed cover letter, LinkedIn headline/About, job-tailored bullets, and recruiter outreach
- **Career coach chat** grounded in the resume, including mock-interview practice
- **History** of past analyses (stored only in your browser) with score changes between runs
- **PDF export** of the full report, light/dark themes, responsive layout

Resumes are processed in memory and never stored on the server.

## Supported career fields

Auto-detected (or chosen manually): Software Engineering · Data & Analytics · Product Management · Design & Creative · Marketing & Communications · Sales & Business Development · Finance & Accounting · Healthcare & Medical · Education & Training · Legal · Engineering (Mech/Civil/Electrical) · Operations & Supply Chain · HR & Recruiting · Customer Service & Hospitality · Skilled Trades · Research & Academia — with a general rubric as fallback.

Seniority levels: Student/Entry · Early career · Mid-level · Senior · Lead/Manager · Executive.

## How it works

The analysis combines deterministic code with AI, and the code checks the AI.

1. **Deterministic layer** — plain, unit-tested code
   - [lib/extract.ts](lib/extract.ts): text extraction (`unpdf`, `mammoth`) with zip-bomb and size guards
   - [lib/signals.ts](lib/signals.ts): contact info, sections, quantification and action-verb ratios, weak phrases, buzzwords, passive voice, repeated verbs, experience timeline, ATS checks
   - [lib/careers.ts](lib/careers.ts): career-field and seniority detection, field-specific priorities, metrics, credentials, and section weights
2. **AI layer** — two structured passes run in parallel ([lib/schema.ts](lib/schema.ts), [lib/prompt.ts](lib/prompt.ts))
   - *Assessment*: scores, strengths, gaps, keywords, JD requirements, recommendations
   - *Content*: summary, headline, bullet rewrites, skills gap, interview questions, career tips
   - If the content pass fails, scores are still returned.
3. **Verification & calibration** — [lib/analysis.ts](lib/analysis.ts), [lib/keywords.ts](lib/keywords.ts)
   - Keywords the AI calls "matched" must actually appear in the resume (with alias handling, e.g. Node.js/NodeJS, CI/CD)
   - Bullet rewrites are dropped if their "original" isn't really in the resume
   - Impact and clarity scores are capped by the measured signals
   - Overall = 50% model judgment + 50% field-weighted section average
   - Job match blends the model's estimate with requirement coverage (must-haves count double) and verified keyword coverage

## Quick start

```bash
npm install

cp .env.example .env.local
# edit .env.local and add your Groq key from https://console.groq.com/keys

npm run dev
# → http://localhost:3000
```

Click **Try a sample** to see a full analysis without uploading anything.

## Environment variables

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | yes | — | https://console.groq.com/keys |
| `GROQ_MODEL` | no | `openai/gpt-oss-120b` | Scoring pass and writing tools. Must support structured output (json_schema). |
| `GROQ_FAST_MODEL` | no | `openai/gpt-oss-20b` | Rewrites/interview-prep pass and chat. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | no | — | Enables durable, cross-instance rate limiting (Vercel KV names also accepted). |
| `NEXT_PUBLIC_SITE_URL` | no | Vercel production URL | Canonical/OG URLs. |

**Why two models?** Groq rate limits are per model. The free tier allows roughly 8k tokens/minute on `gpt-oss-120b`, and one analysis uses about 9k across both passes. Splitting the passes across two models gives each its own budget. On the free tier expect about two analyses per minute; if Groq asks for a short wait, the server waits and retries automatically. If a configured model is retired on Groq, the app falls back to the next available one.

Never commit `.env.local` — it is git-ignored.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest
```

## Project structure

```
app/
  page.tsx                 App shell (header, footer)
  api/
    analyze/route.ts       POST — extract, signals, career detection, two parallel AI passes, verification
    generate/route.ts      POST — streamed cover letter / LinkedIn / tailored bullets / outreach
    chat/route.ts          POST — streamed career-coach chat grounded in the resume
    health/route.ts        GET  — config probe
components/
  analyzer.tsx             Input → progress → dashboard orchestration, history
  upload-form.tsx          Upload/paste, target role, career field, job description
  analysis-progress.tsx    Step-by-step progress view
  recent-analyses.tsx      Browser-local history list
  chat-panel.tsx           Career coach chat
  markdown.tsx             Safe markdown renderer for model output
  dashboard/               Score summary + Overview, Job match, Improve, Interview prep, Writing tools tabs
  ui/                      shadcn/ui components
lib/
  careers.ts               Career fields, seniority, rubrics, weights
  signals.ts               Deterministic signals, timeline, ATS checks
  keywords.ts              Keyword and quote verification
  analysis.ts              Merge, verify, calibrate
  schema.ts                Zod schemas for both AI passes
  prompt.ts                Prompts (analysis, chat, writing tools)
  groq.ts                  Model routing, fallbacks, rate-limit parsing
  extract.ts               PDF/DOCX/TXT extraction
  history.ts               Browser-local history and action-plan state
  rate-limit.ts            Per-IP rate limiting (in-memory or Upstash)
tests/                     Vitest suites for the deterministic and calibration logic
```

## Deploying to Vercel

Import the repo in Vercel and set `GROQ_API_KEY` in the project's Environment Variables (`.env.local` is never deployed). CI runs typecheck, lint, tests, and build on every push to `main`.

Before opening it to real users:

- Provision Upstash Redis (Vercel Marketplace) for durable rate limiting — otherwise limits are per-instance and best-effort.
- Set a spend cap on your Groq account; the AI routes are public.
- Optionally add a Vercel Firewall rate rule or BotID on `/api/analyze`, `/api/generate`, and `/api/chat`.

Security headers (CSP, HSTS, frame-deny), input size caps, ReDoS-safe parsing, DOCX zip-bomb protection, prompt-injection guards, and PII-safe error logging are already in place.

## Swapping the AI provider

All model access goes through the AI SDK in [lib/groq.ts](lib/groq.ts). To use another provider or a paid tier, change the models there; the rest of the app is provider-agnostic.
