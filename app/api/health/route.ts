import { NextResponse } from "next/server";
import { isConfigured } from "@/lib/groq";

export const runtime = "nodejs";

// `aiConfigured` is consumed by the client to show a setup banner. We do NOT
// expose the model id here — that's needless recon for an unauthenticated
// endpoint fronting billable AI routes.
export function GET() {
  return NextResponse.json({
    ok: true,
    aiConfigured: isConfigured(),
    time: new Date().toISOString(),
  });
}
