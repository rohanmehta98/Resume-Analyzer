import { NextResponse } from "next/server";
import { isConfigured, MODEL_ID } from "@/lib/groq";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: true,
    aiConfigured: isConfigured(),
    model: MODEL_ID,
    time: new Date().toISOString(),
  });
}
