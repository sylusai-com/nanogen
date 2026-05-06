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
import {
  getEnabledTextModelByRefWithSecrets,
  listEnabledTextModelsWithSecrets,
  listImageModelsWithSecrets,
} from "@/lib/db/models";
import {
  extractReferenceImageContext,
  extractSubjectImageContext,
  formatReferenceContextForPrompt,
  formatSubjectContextForPrompt,
} from "@/lib/referenceImage";
import { generateBannerBackground } from "@/lib/imageGen";
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

// With multiple admin-enabled models, every model runs in parallel — that's
// the whole point of the fan-out (cross-model variety + best-of-N scoring).
// With ONE model, we keep it to a single call: extra variants aren't
// "parallel" from the user's perspective, they're pure latency overhead.
// Admins can crank this up if they want variety from a single model.
const SOLO_VARIANT_COUNT = 1;
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
  // 4MB cap so users can attach a reference image (data URL). The
  // image is compressed client-side to a few hundred KB but we leave
  // headroom for very large uploads.
  try { body = await readJson(req, { maxBytes: 4 * 1024 * 1024 }); }
  catch (e) { return errorResponse(e); }

  let prompt, style, aspect, referenceImage, subjectImage, modelRef, regenerateFromId, regenerateContext;
  try {
    prompt = validateString(body.prompt, {
      name: "prompt", min: 3, max: 4000, required: true,
    });
    // Style is OPTIONAL. Don't substitute a "Modern" default — if the
    // user didn't pick a style we want the model to choose freely from
    // the brief alone, not be biased toward a theme they never asked for.
    style  = validateString(body.style, { name: "style", max: 60 }) || null;
    aspect = validateEnum(body.aspect, ALLOWED_ASPECTS, { name: "aspect" }) || "16:9";

    // Optional model selection from the dashboard ChatGPT-style picker.
    // When unset (or "auto"), we fan out across every enabled model.
    // Otherwise we look up that specific model and use only it.
    modelRef = validateString(body.model, { name: "model", max: 80 }) || null;

    // Optional user-uploaded reference image (inspiration only — the AI
    // extracts subject/palette/mood from it). Accept either a data URL
    // or an https URL.
    if (typeof body.referenceImage === "string") {
      const ri = body.referenceImage.trim();
      if (ri.startsWith("data:image/") || /^https?:\/\//i.test(ri)) {
        referenceImage = ri;
      }
    }

    // Optional user-uploaded subject image (a person, product, etc the
    // user wants visible IN the banner — used as the bg_image value).
    if (typeof body.subjectImage === "string") {
      const si = body.subjectImage.trim();
      if (si.startsWith("data:image/") || /^https?:\/\//i.test(si)) {
        subjectImage = si;
      }
    }

    // Regenerate flow: when set, the client is asking us to refresh an
    // existing banner using the new prompt + the existing context. We
    // load the prior banner here so its prompt/style/aspect/reference
    // become the defaults the user can override.
    regenerateFromId = validateString(body.regenerateFromId, { name: "regenerateFromId", max: 80 }) || null;
    if (regenerateFromId) {
      const { data: prior } = await supabase
        .from("banners")
        .select("id, prompt, style, aspect, reference_image_url, reference_context, subject_image_url, fields, model_id")
        .eq("id", regenerateFromId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (prior) {
        regenerateContext = prior;
        // Inherit prior settings whenever the client did not supply them.
        if (!style)  style  = prior.style  || null;
        if (!body.aspect) aspect = prior.aspect || aspect;
        if (!referenceImage && prior.reference_image_url) {
          referenceImage = prior.reference_image_url;
        }
        // Carry the subject image forward when the client did not upload
        // a new one. Prefer the dedicated column; fall back to digging
        // the data URI out of the prior banner's bg_image field for
        // banners created before 0011_banner_subject_image landed.
        if (!subjectImage && prior.subject_image_url) {
          subjectImage = prior.subject_image_url;
        }
        if (!subjectImage && Array.isArray(prior.fields)) {
          const bg = prior.fields.find((f) => f?.id === "bg_image");
          const raw = String(bg?.value || "");
          const m = raw.match(/^url\(["']?(.+?)["']?\)$/i);
          const inner = (m ? m[1] : raw).trim();
          if (inner.startsWith("data:image/") || /^https?:\/\//i.test(inner)) {
            subjectImage = inner;
          }
        }
      }
    }
  } catch (e) { return errorResponse(e); }

  // 1. Resolve which text model(s) to use. If the user picked a specific
  //    model from the dashboard dropdown, only that model runs. Otherwise
  //    we fan out across every enabled text model in parallel (legacy
  //    "auto" behavior). We always go through the admin client so the
  //    apiKey column is in scope (server-side only).
  const adminClient = createAdminClient();

  let usable;
  if (modelRef && modelRef !== "auto") {
    const picked = await getEnabledTextModelByRefWithSecrets(adminClient, modelRef);
    if (!picked) {
      return NextResponse.json(
        { error: "Selected model is not enabled. Pick a different model or use Auto." },
        { status: 400 },
      );
    }
    if (!pickApiKey(picked)) {
      return NextResponse.json(
        { error: `Model "${picked.label}" has no API key configured. Ask an admin to set one.` },
        { status: 400 },
      );
    }
    usable = [picked];
  } else {
    const allModels = await listEnabledTextModelsWithSecrets(adminClient);
    usable = allModels.filter((m) => pickApiKey(m));
  }

  // 2. Vision-extract context for whichever images the user uploaded.
  //    Reference image → mood/palette/motifs (inspiration only).
  //    Subject image  → placement/treatment guidance + dominant colors
  //                     (this image will be visible IN the banner via
  //                      the bg_image field, so the model needs to know
  //                      how to integrate it cleanly — masks, blends,
  //                      where to place headlines so they don't cover
  //                      a person's face, etc).
  //    Both run in parallel — they're independent vision calls. Failure
  //    in either degrades the prompt without aborting the request.
  const [referenceContext, subjectContext] = await Promise.all([
    referenceImage
      ? extractReferenceImageContext({ adminClient, imageUrl: referenceImage })
      : Promise.resolve(null),
    subjectImage
      ? extractSubjectImageContext({ adminClient, imageUrl: subjectImage })
      : Promise.resolve(null),
  ]);
  const referenceContextText = formatReferenceContextForPrompt(referenceContext);
  const subjectContextText   = formatSubjectContextForPrompt(subjectContext);

  // 2b. If no user-uploaded subject image is present AND the admin has
  //     enabled an image model, generate a banner-quality background
  //     image now and inject it as bg_image on every text-model variant.
  //     The subject upload is authoritative when present — image-gen is
  //     only a substitute for a missing subject.
  //
  //     Best-effort: a failed image call falls back to the existing
  //     "text model emits inline SVG / CSS-only background" behavior.
  let aiBackgroundImage = null;
  let aiBackgroundError = null;
  let aiBackgroundModel = null;
  if (!subjectImage) {
    const imageModels = await listImageModelsWithSecrets(adminClient).catch(() => []);
    const imageModel = imageModels.find((m) => pickApiKey(m)) || null;
    if (imageModel) {
      const result = await generateBannerBackground({
        imageModel,
        brief: prompt,
        style,
        aspect,
        referenceContext,
        subjectContext,
      });
      if (result?.dataUrl) {
        aiBackgroundImage = result.dataUrl;
        aiBackgroundModel = {
          modelId: result.modelId,
          modelLabel: result.modelLabel,
          provider: result.provider,
        };
      } else if (result?.error) {
        aiBackgroundError = result.error;
      }
    }
  }

  // 3. Build the work plan. With ≥ 2 usable models, fan out 1-per-model
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

  // 4. Generate every variant in parallel. Each call is independent —
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
        referenceContextText,
        subjectContextText,
        subjectImage,
        backgroundImage: aiBackgroundImage,
      }),
    ),
  );

  // Track per-model failures so the dashboard can show admins which
  // configurations are broken without forcing them to read server logs.
  // The image-gen failure (when present) lands here too so admins can
  // see "image model called but errored, fell back to text-only bg".
  const modelErrors = [];
  if (aiBackgroundError) {
    modelErrors.push({
      modelId:    null,
      modelLabel: "image-bg",
      reason:     aiBackgroundError,
    });
  }
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

  // 7. Persist the full generation run (all model variants) so dashboard
  // can show one prompt with all model outputs grouped together. The
  // reference image (and its extracted context) are stored on the run so
  // every variant in the run shares the same inspiration source.
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
      reference_image_url: referenceImage || null,
      reference_context:   referenceContext  || null,
      subject_image_url:   subjectImage      || null,
      subject_context:     subjectContext    || null,
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

  // 8. Persist a banner row per model variant in this run. The
  //    reference image (data: URI) and the extracted context are stored
  //    on every banner so /dashboard/banners/[id] can show the user the
  //    image they uploaded alongside the AI-generated banner.
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
      reference_image_url: referenceImage   || null,
      reference_context:   referenceContext || null,
      subject_image_url:   subjectImage     || null,
      subject_context:     subjectContext   || null,
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
    // True when this run was triggered by /dashboard/banners/[id]/edit's
    // "Regenerate" button. The client uses this to update the active
    // banner row instead of pushing the user to the new variant.
    regeneratedFrom: regenerateContext ? regenerateFromId : null,
    // Which image model produced the bg layer this run, if any. Null
    // when no image model was configured / the user supplied a subject
    // (subject upload always wins) / image-gen failed.
    backgroundModel: aiBackgroundModel,
  });
}
