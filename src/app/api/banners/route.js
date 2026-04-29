// src/app/api/banners/route.js
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  bgFromTemplate,
  deriveTitle,
  generateBannerTemplate,
  pickApiKey,
} from "@/lib/bannerTemplate";
import { scoreBannerTemplate } from "@/lib/scoreBanner";
import { listEnabledTextModelsWithSecrets } from "@/lib/db/models";
import { SCORE_THRESHOLD } from "@/lib/models";
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

// When only ONE text model is configured we still want some variety, so
// we run that model N times with different archetype seeds. With multiple
// models, each gets a single shot — comparing across models is the point.
const SOLO_VARIANT_COUNT = 3;
const ALLOWED_ASPECTS    = ["1:1", "4:5", "9:16", "16:9"];

// Generate an HTML banner from a prompt by fanning out across every
// admin-enabled text model in parallel, scoring each result, and
// persisting the winner.
//
// Winner rule: highest score >= SCORE_THRESHOLD; if none reach the
// threshold, the absolute top scorer is selected so the user always
// gets a banner back.
//
// Used by /dashboard/create. The user is then redirected to the editor.
export async function POST(req) {
  // CSRF: only accept same-origin browser requests.
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit per signed-in user. Banner generation is expensive (one
  // model call per enabled text model + one score call each).
  const rl = rateLimit({
    key:      clientKey(req, user.id),
    max:      12,
    windowMs: 5 * 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
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
    style  = validateString(body.style, { name: "style", max: 60 }) || "Modern";
    aspect = validateEnum(body.aspect, ALLOWED_ASPECTS, { name: "aspect" }) || "16:9";
  } catch (e) { return errorResponse(e); }

  // 1. Resolve every enabled text model with secrets server-side (admin
  //    client bypasses RLS for the config column). Filter to rows that
  //    actually have an apiKey configured — there's no point hitting a
  //    misconfigured row, and we want clear "no models configured"
  //    messaging when admin hasn't set anything up yet.
  const adminClient = createAdminClient();
  const allModels   = await listEnabledTextModelsWithSecrets(adminClient);
  const usable      = allModels.filter((m) => pickApiKey(m));

  // 2. Build the work plan. With ≥ 2 usable models, fan out 1-per-model
  //    so the user actually gets cross-model variety. With 1 model, run
  //    SOLO_VARIANT_COUNT variants (different archetype seeds). With 0
  //    models we still call generateBannerTemplate so the rich fallback
  //    is rendered + a "configure a model" reason is surfaced.
  let plan;
  if (usable.length === 0) {
    plan = [{ model: null, variantSeed: 0 }];
  } else if (usable.length === 1) {
    plan = Array.from({ length: SOLO_VARIANT_COUNT }, (_, i) => ({
      model: usable[0],
      variantSeed: i,
    }));
  } else {
    plan = usable.map((m, i) => ({ model: m, variantSeed: i }));
  }

  // 3. Generate every variant in parallel. Each call is independent —
  //    one model failing doesn't cancel the others (Promise.allSettled).
  const settled = await Promise.allSettled(
    plan.map(({ model, variantSeed }) =>
      generateBannerTemplate({
        supabase,
        prompt,
        style,
        aspect,
        variantSeed,
        textModel: model,
      }),
    ),
  );

  // Track per-model failures so the dashboard can show admins which
  // configurations are broken without forcing them to read server logs.
  const modelErrors = [];
  const variants = settled.map((s, i) => {
    const planned = plan[i];
    if (s.status === "fulfilled") {
      const t = s.value;
      // generateBannerTemplate always returns SOMETHING — but when it
      // returns the fallback because of a model failure, surface that
      // through modelErrors so the UI can flag it.
      if (t?.generator === "fallback" && t?.reason && planned.model) {
        modelErrors.push({
          modelId:   planned.model.modelId,
          modelLabel: planned.model.label,
          reason:    t.reason,
        });
      }
      return t;
    }
    // generateBannerTemplate is meant to never reject — but defend anyway.
    modelErrors.push({
      modelId:   planned.model?.modelId || null,
      modelLabel: planned.model?.label  || "fallback",
      reason:    s.reason?.message || "Unknown error",
    });
    return null;
  });

  const usableVariants = variants.filter(Boolean);
  if (usableVariants.length === 0) {
    return NextResponse.json(
      { error: "Failed to generate any banner variants. " + (modelErrors[0]?.reason || "") },
      { status: 500 },
    );
  }

  // 4. Score every variant in parallel.
  const scored = await Promise.all(
    usableVariants.map(async (t) => {
      const s = await scoreBannerTemplate({
        supabase,
        prompt,
        style,
        aspect,
        html: t.html || "",
        css:  t.css  || "",
      });
      return {
        template:    t,
        score:       s.score,
        scoreSource: s.source,
        scoreReason: s.reason,
      };
    }),
  );

  // 5. Pick winner: top score >= threshold, else absolute top scorer.
  const ranked  = [...scored].sort((a, b) => b.score - a.score);
  const passing = ranked.filter((v) => v.score >= SCORE_THRESHOLD);
  const winner  = passing[0] || ranked[0];

  if (!winner) {
    return NextResponse.json(
      { error: "Failed to generate any banner variants." },
      { status: 500 },
    );
  }

  const template        = winner.template;
  const passedThreshold = winner.score >= SCORE_THRESHOLD;

  // 6. Persist the full generation run (all model variants) so dashboard
  // can show one prompt with all model outputs grouped together.
  const modelsForRun = plan
    .map((p) => p.model?.modelId)
    .filter(Boolean);
  const { data: runRow, error: runErr } = await supabase
    .from("generation_runs")
    .insert({
      user_id: user.id,
      prompt,
      aspect,
      style,
      models: modelsForRun.length ? modelsForRun : ["fallback"],
    })
    .select("id")
    .single();

  if (runErr) {
    return NextResponse.json(
      { error: `Failed to save generation run: ${runErr.message}` },
      { status: 500 },
    );
  }

  const runId = runRow.id;

  const resultRowsInput = scored.map((v) => {
    const imageField = (v.template?.fields || []).find(
      (f) => f?.type === "image" && f.id === "bg_image",
    );
    const imageUrl = imageField?.value || null;
    return {
      run_id: runId,
      user_id: user.id,
      model_id: v.template.modelId || "fallback",
      model_label: v.template.generator || "fallback",
      provider: v.template.provider || null,
      image_url: imageUrl,
      preview_gradient: v.template.styleRow?.gradient || null,
      score: v.score,
      latency_ms: null,
      is_winner: v === winner,
    };
  });

  const { data: savedResults, error: resultsErr } = await supabase
    .from("generation_results")
    .insert(resultRowsInput)
    .select("id, model_id, model_label, score, is_winner");

  if (resultsErr) {
    return NextResponse.json(
      { error: `Failed to save generation results: ${resultsErr.message}` },
      { status: 500 },
    );
  }

  // 7. Persist a banner row per model variant in this run.
  const bannerRows = scored.map((v) => {
    const t = v.template;
    const bg = bgFromTemplate(t);
    const headline = (t.fields || []).find((f) => f.id === "headline");
    const baseTitle = headline?.value
      ? headline.value.length > 60
        ? headline.value.slice(0, 60) + "…"
        : headline.value
      : deriveTitle(prompt);
    const modelLabel = t.generator || "fallback";
    const resultRow = savedResults.find(
      (r) => r.model_label === modelLabel && r.score === v.score,
    );

    return {
      user_id: user.id,
      run_id: runId,
      result_id: resultRow?.id || null,
      title: scored.length > 1 ? `${baseTitle} · ${modelLabel}` : baseTitle,
      prompt,
      style,
      aspect,
      model_id: t.modelId || null,
      model_label: modelLabel,
      preview_gradient: t.styleRow?.gradient || null,
      score: v.score,
      html: t.html,
      css: t.css,
      fields: t.fields,
      alignment: t.alignment,
      canvas: { background: bg, elements: [] },
    };
  });

  const { data: savedBanners, error: bannersErr } = await supabase
    .from("banners")
    .insert(bannerRows)
    .select("id, title, model_label, score");

  if (bannersErr || !savedBanners?.length) {
    return NextResponse.json(
      { error: `Failed to save banners: ${bannersErr?.message || "Unknown error"}` },
      { status: 500 },
    );
  }

  const rankedBanners = [...savedBanners].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const winnerBanner = rankedBanners.find((b) => b.model_label === (template.generator || "fallback") && b.score === winner.score)
    || rankedBanners[0];

  return NextResponse.json({
    banner: winnerBanner,
    runId,
    banners: rankedBanners,
    generator: template.generator,
    // Surface the fallback reason when the WINNER fell back. Null when
    // a real model produced it, even if other variants failed.
    reason:    template.reason || null,
    score:     winner.score,
    threshold: SCORE_THRESHOLD,
    passedThreshold,
    scoring: {
      source: winner.scoreSource,
      reason: winner.scoreReason,
    },
    variants: scored.map((v) => ({
      score:     v.score,
      generator: v.template.generator,
      modelId:   v.template.modelId || null,
      provider:  v.template.provider || null,
    })),
    // Per-model errors — admin can fix configurations without reading logs.
    modelErrors,
  });
}
