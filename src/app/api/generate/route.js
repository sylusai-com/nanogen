import { NextResponse } from "next/server";
import { MODELS, SCORE_THRESHOLD } from "@/lib/models";

export const runtime = "nodejs";

// Phase 1 stub: simulates the multi-model fan-out + scoring pipeline.
// Replace `runModel` and `scoreImage` with real provider calls (Replicate,
// Fal, OpenAI, Stability, etc.) and your scoring service.
async function runModel(modelId, payload) {
  // Simulate network latency that varies per model.
  const latency = 600 + Math.random() * 1400;
  await new Promise((r) => setTimeout(r, latency));

  const meta = MODELS.find((m) => m.id === modelId);
  return {
    id: `${modelId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    modelId,
    modelLabel: meta?.label ?? modelId,
    provider: meta?.provider ?? "Unknown",
    previewGradient: meta?.previewGradient ?? "from-violet-500/30 to-cyan-400/30",
    imageUrl: null, // TODO: provider returns hosted URL or base64
    prompt: payload.prompt,
    aspect: payload.aspect,
    style: payload.style,
    latencyMs: Math.round(latency),
  };
}

async function scoreImage(/* result */) {
  // TODO: call vision-based scoring model. For now return a plausible score
  // weighted toward the passing range.
  const base = 65 + Math.random() * 35; // 65–100
  return Math.round(Math.min(100, base));
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { prompt, aspect = "16:9", style, models = [] } = body || {};
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }
  const enabledIds = MODELS.filter((m) => m.enabled).map((m) => m.id);
  const selected = models.filter((id) => enabledIds.includes(id));
  if (selected.length === 0) {
    return NextResponse.json({ error: "Select at least one enabled model" }, { status: 400 });
  }

  // Fan out in parallel.
  const generated = await Promise.all(
    selected.map((id) => runModel(id, { prompt, aspect, style }))
  );

  // Score in parallel.
  const scored = await Promise.all(
    generated.map(async (r) => ({ ...r, score: await scoreImage(r) }))
  );

  // Pick the highest-scoring result that passes the threshold.
  const passing = scored.filter((r) => r.score >= SCORE_THRESHOLD);
  const ranked = [...passing].sort((a, b) => b.score - a.score);
  const winner = ranked[0] ?? null;

  return NextResponse.json({
    prompt,
    aspect,
    style,
    threshold: SCORE_THRESHOLD,
    results: scored.sort((a, b) => b.score - a.score),
    winnerId: winner?.id ?? null,
  });
}
