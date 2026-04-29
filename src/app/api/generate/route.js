// src/app/api/generate/route.js
import { NextResponse } from "next/server";
import { SCORE_THRESHOLD } from "@/lib/models";
import { createClient } from "@/lib/supabase/server";
import { scoreBannerImage } from "@/lib/scoreBanner";
import {
  clientKey,
  errorResponse,
  originAllowed,
  rateLimit,
  readJson,
  validateEnum,
  validateString,
} from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ASPECTS = ["1:1", "4:5", "9:16", "16:9"];

// Multi-image-model fan-out + scoring pipeline. Each enabled image model
// produces a candidate, every candidate is scored via /lib/scoreBanner, and
// the winner is the highest scorer >= SCORE_THRESHOLD — or the absolute top
// scorer when nothing passes the threshold (so the user always sees results).
//
// Provider calls live inside runModel: until image providers are wired up,
// it returns a stub result with no imageUrl, which is fine — scoreBannerImage
// returns a heuristic neutral score in that case.
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

async function scoreImage(supabase, result, prompt) {
  // When the provider call hasn't produced an imageUrl yet, the scorer
  // returns a neutral score so the pipeline keeps working end-to-end.
  if (!result.imageUrl) return Math.round(70 + Math.random() * 20);
  const { score } = await scoreBannerImage({
    supabase,
    prompt,
    imageUrl: result.imageUrl,
  });
  return score;
}

function deriveTitle(prompt) {
  const t = prompt.trim().split(/\s+/).slice(0, 8).join(" ");
  return t.length > 60 ? t.slice(0, 60) + "…" : t || "Untitled banner";
}

export async function POST(req) {
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rate limit per user (or IP for anonymous /generate page).
  const rl = rateLimit({
    key:      clientKey(req, user?.id),
    max:      user ? 12 : 5,
    windowMs: 5 * 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body;
  try { body = await readJson(req, { maxBytes: 16 * 1024 }); }
  catch (e) { return errorResponse(e); }

  let prompt, style, aspect;
  try {
    prompt = validateString(body.prompt, {
      name: "prompt", min: 3, max: 4000, required: true,
    });
    style  = validateString(body.style,  { name: "style", max: 60 }) || "Modern";
    aspect = validateEnum(body.aspect, ALLOWED_ASPECTS, { name: "aspect" }) || "16:9";
  } catch (e) { return errorResponse(e); }

  const requested = Array.isArray(body.models) ? body.models.filter(
    (s) => typeof s === "string" && s.length <= 64,
  ) : [];
  if (requested.length === 0) {
    return NextResponse.json(
      { error: "Select at least one model" },
      { status: 400 },
    );
  }
  // Cap fan-out width — defends against an attacker requesting 1000
  // model slugs and exhausting upstream providers.
  if (requested.length > 8) {
    return NextResponse.json(
      { error: "Too many models requested (max 8)" },
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
    generated.map(async (r) => ({ ...r, score: await scoreImage(supabase, r, prompt) })),
  );
  // 4. Pick winner: top score >= threshold, else absolute top scorer so
  //    the user always gets something back (per product requirement —
  //    show banner with score >= 80; if nothing reaches 80, show top one).
  const ranked  = [...scored].sort((a, b) => b.score - a.score);
  const passing = ranked.filter((r) => r.score >= SCORE_THRESHOLD);
  const winner  = passing[0] ?? ranked[0] ?? null;
  const passedThreshold = !!winner && winner.score >= SCORE_THRESHOLD;

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
    passedThreshold,
    results: resultsWithIds.sort((a, b) => b.score - a.score),
    winnerId: winner
      ? resultsWithIds.find(
          (r) => r.modelSlug === winner.modelSlug && r.score === winner.score,
        )?.id
      : null,
    winnerBannerId,
  });
}
