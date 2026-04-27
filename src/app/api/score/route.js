// src/app/api/score/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Phase 1 stub: standalone scoring endpoint. Wire this to your vision model
// (e.g. an LLM with vision, an aesthetic-quality classifier, etc.).
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { imageUrl } = body || {};
  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  }

  // Placeholder score. Replace with a real evaluator.
  const score = Math.round(70 + Math.random() * 30);
  return NextResponse.json({ imageUrl, score });
}
