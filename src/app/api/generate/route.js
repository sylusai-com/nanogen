// src/app/api/generate/route.js
import { NextResponse } from "next/server";
import { SCORE_THRESHOLD } from "@/lib/models";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Phase 1+2+3 stub: simulates the multi-model fan-out + scoring pipeline,
// then persists the run + results + auto-saves the winning banner.
//
// The model catalog now lives in the DB (`public.models`). Wire real
// provider calls inside `runModel` — provider-specific adapters can be
// switched on `model.provider`.
async function runModel(model, payload) {
  const latency = 600 + Math.random() * 1400;
  await new Promise((r) => setTimeout(r, latency));
  return {
    modelSlug: model.slug,
    modelLabel: model.label,
    provider: model.provider,
    providerModelId: model.modelId,
    previewGradient:
      model.previewGradient || "from-violet-500/30 to-cyan-400/30",
    imageUrl: null, // TODO: wire provider call (Replicate / Stability / etc.)
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

  const { prompt, aspect = "16:9", style, models: requested = [] } = body || {};
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }
  if (!Array.isArray(requested) || requested.length === 0) {
    return NextResponse.json(
      { error: "Select at least one model" },
      { status: 400 },
    );
  }

  // 1. Resolve models from the DB. Only enabled image models.
  const { data: dbModels, error: modelsErr } = await supabase
    .from("models")
    .select(
      "slug, label, provider, modelId:model_id, previewGradient:preview_gradient",
    )
    .eq("kind", "image")
    .eq("enabled", true)
    .in("slug", requested);

  if (modelsErr) {
    return NextResponse.json(
      { error: `Failed to load models: ${modelsErr.message}` },
      { status: 500 },
    );
  }

  if (!dbModels || dbModels.length === 0) {
    return NextResponse.json(
      { error: "None of the selected models are enabled" },
      { status: 400 },
    );
  }

  // 2. Run models in parallel.
  const generated = await Promise.all(
    dbModels.map((m) => runModel(m, { prompt, aspect, style })),
  );
  // 3. Score in parallel.
  const scored = await Promise.all(
    generated.map(async (r) => ({ ...r, score: await scoreImage(r) })),
  );
  // 4. Pick winner from passing outputs.
  const passing = scored.filter((r) => r.score >= SCORE_THRESHOLD);
  const ranked = [...passing].sort((a, b) => b.score - a.score);
  const winner = ranked[0] ?? null;

  // 5. Persist (only if signed in — anonymous /generate page still works).
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
        models: dbModels.map((m) => m.slug),
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
      model_id: r.modelSlug,
      model_label: r.modelLabel,
      provider: r.provider,
      image_url: r.imageUrl,
      preview_gradient: r.previewGradient,
      score: r.score,
      latency_ms: r.latencyMs,
      is_winner: winner
        ? r.modelSlug === winner.modelSlug && r.score === winner.score
        : false,
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

    resultsWithIds = scored.map((r) => {
      const match = resultRows.find(
        (row) => row.model_id === r.modelSlug && row.score === r.score,
      );
      return {
        ...r,
        id: match?.id ?? `${r.modelSlug}-${Date.now()}`,
        modelId: r.modelSlug, // keep camelCase shape that BannerCard expects
      };
    });

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
          model_id: winner.modelSlug,
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
    resultsWithIds = scored.map((r) => ({
      ...r,
      id: `${r.modelSlug}-${Math.random().toString(36).slice(2, 9)}`,
      modelId: r.modelSlug,
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
      ? resultsWithIds.find(
          (r) => r.modelSlug === winner.modelSlug && r.score === winner.score,
        )?.id
      : null,
    winnerBannerId,
  });
}
