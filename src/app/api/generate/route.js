import { NextResponse } from "next/server";
import { MODELS, SCORE_THRESHOLD } from "@/lib/models";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Phase 1+2 stub: simulates the multi-model fan-out + scoring pipeline,
// then persists the run + results + auto-saves the winning banner.
// Replace `runModel` and `scoreImage` with real provider calls when keys are
// in place — the persistence layer below stays the same.
async function runModel(modelId, payload) {
  const latency = 600 + Math.random() * 1400;
  await new Promise((r) => setTimeout(r, latency));
  const meta = MODELS.find((m) => m.id === modelId);
  return {
    modelId,
    modelLabel: meta?.label ?? modelId,
    provider: meta?.provider ?? "Unknown",
    previewGradient: meta?.previewGradient ?? "from-violet-500/30 to-cyan-400/30",
    imageUrl: null, // TODO: real provider returns a hosted URL or data URL
    latencyMs: Math.round(latency),
    prompt: payload.prompt,
    aspect: payload.aspect,
    style: payload.style,
  };
}

async function scoreImage(/* result */) {
  // TODO: vision-based scoring service.
  return Math.round(Math.min(100, 65 + Math.random() * 35));
}

function deriveTitle(prompt) {
  const t = prompt.trim().split(/\s+/).slice(0, 8).join(" ");
  return t.length > 60 ? t.slice(0, 60) + "…" : t || "Untitled banner";
}

export async function POST(req) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    return NextResponse.json(
      { error: "Select at least one enabled model" },
      { status: 400 },
    );
  }

  // 1. Run models in parallel.
  const generated = await Promise.all(
    selected.map((id) => runModel(id, { prompt, aspect, style })),
  );
  // 2. Score in parallel.
  const scored = await Promise.all(
    generated.map(async (r) => ({ ...r, score: await scoreImage(r) })),
  );
  // 3. Pick winner from passing outputs.
  const passing = scored.filter((r) => r.score >= SCORE_THRESHOLD);
  const ranked = [...passing].sort((a, b) => b.score - a.score);
  const winner = ranked[0] ?? null;

  // 4. Persist (only if signed in — anonymous /generate page still works).
  let runId = null;
  let resultsWithIds = scored;
  let winnerBannerId = null;

  if (user) {
    const { data: runRow, error: runErr } = await supabase
      .from("generation_runs")
      .insert({
        user_id: user.id,
        prompt,
        aspect,
        style,
        models: selected,
      })
      .select("id")
      .single();

    if (runErr) {
      return NextResponse.json(
        { error: `Failed to record run: ${runErr.message}` },
        { status: 500 },
      );
    }
    runId = runRow.id;

    const rows = scored.map((r) => ({
      run_id: runId,
      user_id: user.id,
      model_id: r.modelId,
      model_label: r.modelLabel,
      provider: r.provider,
      image_url: r.imageUrl,
      preview_gradient: r.previewGradient,
      score: r.score,
      latency_ms: r.latencyMs,
      is_winner: winner ? r.modelId === winner.modelId && r.score === winner.score : false,
    }));

    const { data: resultRows, error: resultsErr } = await supabase
      .from("generation_results")
      .insert(rows)
      .select("id, model_id, score, is_winner");

    if (resultsErr) {
      return NextResponse.json(
        { error: `Failed to record results: ${resultsErr.message}` },
        { status: 500 },
      );
    }

    // Map server-assigned ids back into the response payload.
    resultsWithIds = scored.map((r) => {
      const match = resultRows.find(
        (row) => row.model_id === r.modelId && row.score === r.score,
      );
      return { ...r, id: match?.id ?? `${r.modelId}-${Date.now()}` };
    });

    // 5. Auto-save the winner as a banner.
    if (winner) {
      const winningRow = resultRows.find((row) => row.is_winner);
      const { data: banner, error: bannerErr } = await supabase
        .from("banners")
        .insert({
          user_id: user.id,
          result_id: winningRow?.id ?? null,
          title: deriveTitle(prompt),
          prompt,
          style,
          aspect,
          model_id: winner.modelId,
          model_label: winner.modelLabel,
          image_url: winner.imageUrl,
          preview_gradient: winner.previewGradient,
          score: winner.score,
        })
        .select("id")
        .single();

      if (!bannerErr) winnerBannerId = banner.id;
    }
  } else {
    // Anonymous run — fabricate ids so the UI keys stay stable.
    resultsWithIds = scored.map((r) => ({
      ...r,
      id: `${r.modelId}-${Math.random().toString(36).slice(2, 9)}`,
    }));
  }

  return NextResponse.json({
    runId,
    prompt,
    aspect,
    style,
    threshold: SCORE_THRESHOLD,
    results: resultsWithIds.sort((a, b) => b.score - a.score),
    winnerId: winner
      ? resultsWithIds.find((r) => r.modelId === winner.modelId && r.score === winner.score)?.id
      : null,
    winnerBannerId,
  });
}
