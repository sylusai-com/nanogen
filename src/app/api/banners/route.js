// src/app/api/banners/route.js
// src/app/api/banners/route.js
// Banner generation endpoint - returns immediately with jobId for polling
// Actual generation happens in background, tracked via /api/generation-status/[jobId]

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
import { generateBannerBackground, urlToBase64 } from "@/lib/imageGen";
import {
  listBgImageProviders,
  fetchBgImageFromProvider,
} from "@/lib/db/bgImageProviders";
import { removeSubjectBackground } from "@/lib/bgRemoval";
import { storeBannerImageAsset } from "@/lib/server/bannerImageStorage";
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

import { createJob, GenerationJobSteps } from "@/lib/generationQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOLO_VARIANT_COUNT = 1;
const ALLOWED_ASPECTS = ["1:1", "4:5", "9:16", "16:9"];

// POST handler: Quick validation + job creation, returns immediately
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

  // Rate limit per signed-in user
  const rl = rateLimit({
    key: clientKey(req, user.id),
    max: 12,
    windowMs: 5 * 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body;
  try {
    body = await readJson(req, { maxBytes: 4 * 1024 * 1024 });
  } catch (e) {
    return errorResponse(e);
  }

  // Validate required fields
  let prompt, style, aspect, referenceImage, subjectImage, modelRef, regenerateFromId, regenerateContext;
  try {
    prompt = validateString(body.prompt, {
      name: "prompt",
      min: 3,
      max: 4000,
      required: true,
    });
    style = validateString(body.style, { name: "style", max: 60 }) || null;
    aspect = validateEnum(body.aspect, ALLOWED_ASPECTS, { name: "aspect" }) || "16:9";
    modelRef = validateString(body.model, { name: "model", max: 80 }) || null;

    // Optional reference image (data URL or https URL)
    if (typeof body.referenceImage === "string") {
      const ri = body.referenceImage.trim();
      if (ri.startsWith("data:image/") || /^https?:\/\//i.test(ri)) {
        referenceImage = ri;
      }
    }

    // Optional subject image (data URL or https URL)
    if (typeof body.subjectImage === "string") {
      const si = body.subjectImage.trim();
      if (si.startsWith("data:image/") || /^https?:\/\//i.test(si)) {
        subjectImage = si;
      }
    }

    // Regenerate flow: load prior banner context
    regenerateFromId = validateString(body.regenerateFromId, { name: "regenerateFromId", max: 80 }) || null;
    if (regenerateFromId) {
      const { data: prior } = await supabase
        .from("banners")
        .select("id, prompt, style, aspect, reference_image_url, reference_context, subject_image_url, fields")
        .eq("id", regenerateFromId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (prior) {
        regenerateContext = prior;
        if (!style) style = prior.style || null;
        if (!body.aspect) aspect = prior.aspect || aspect;
        if (!referenceImage && prior.reference_image_url) {
          referenceImage = prior.reference_image_url;
        }
        if (!subjectImage && prior.subject_image_url) {
          subjectImage = prior.subject_image_url;
        }
      }
    }
  } catch (e) {
    return errorResponse(e);
  }

  // Create job and start background generation
  const job = createJob(user.id, {
    prompt,
    style,
    aspect,
    referenceImage,
    subjectImage,
    modelRef,
    regenerateFromId,
  });

  job.setStatus("processing");
  job.setStep(GenerationJobSteps.UPLOAD_IMAGES);

  // Start background generation (don't await)
  performBannerGeneration(
    job,
    user.id,
    {
      prompt,
      style,
      aspect,
      referenceImage,
      subjectImage,
      modelRef,
    }
  ).catch((error) => {
    console.error(`[Job ${job.jobId}] Generation failed:`, error);
    job.setError(error.message, error);
  });

  // Return immediately with job ID for polling
  return NextResponse.json({
    jobId: job.jobId,
    status: "processing",
    estimatedTime: "15-30 seconds",
    pollUrl: `/api/generation-status/${job.jobId}`,
  });
}

// Background generation worker - runs in parallel without blocking response
async function performBannerGeneration(job, userId, payload) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const { prompt, style, aspect, referenceImage, subjectImage, modelRef } = payload;

  try {
    // Step 1: Validate images exist and are accessible
    job.setStep(GenerationJobSteps.UPLOAD_IMAGES);
    // (Image URLs are already validated in POST handler)

    // If the client provided data URLs for reference/subject, store them
    // server-side and replace with the public URL before analysis. This
    // keeps the base64 data for model analysis ephemeral while the
    // banner saves reference to a stable stored URL.
    let refImageUrl = referenceImage;
    let subjImageUrl = subjectImage;
    if (refImageUrl && typeof refImageUrl === "string" && refImageUrl.startsWith("data:image/")) {
      try {
        const stored = await storeBannerImageAsset({ dataUrl: refImageUrl, userId, bannerId: null, jobId: job.jobId, adminClient });
        if (stored) refImageUrl = stored;
      } catch (e) {
        console.warn("Failed to store reference image; continuing with data URL", e?.message || e);
      }
    }
    if (subjImageUrl && typeof subjImageUrl === "string" && subjImageUrl.startsWith("data:image/")) {
      try {
        const stored = await storeBannerImageAsset({ dataUrl: subjImageUrl, userId, bannerId: null, jobId: job.jobId, adminClient });
        if (stored) subjImageUrl = stored;
      } catch (e) {
        console.warn("Failed to store subject image; continuing with data URL", e?.message || e);
      }
    }

    // Step 1b: Strip the subject's background. When REMOVE_BG_API_KEY is
    // configured, this swaps the user-uploaded photo for a transparent
    // PNG so the bg-image layer composes cleanly over whatever bg the
    // model / provider / image-gen produces. Failures (no key, API down,
    // unsupported format) silently fall through — the original image is
    // still used and the banner still renders.
    let cleanedSubjectDataUrl = null;
    if (subjImageUrl) {
      try {
        const cutout = await removeSubjectBackground(subjImageUrl);
        if (cutout?.dataUrl) {
          cleanedSubjectDataUrl = cutout.dataUrl;
          // Persist the cutout to storage so the banner row references
          // a stable URL, not a 1MB+ data URI in the DB column.
          try {
            const stored = await storeBannerImageAsset({
              dataUrl: cutout.dataUrl,
              userId,
              jobId: job.jobId,
              adminClient,
            });
            if (stored) {
              subjImageUrl = stored;
              cleanedSubjectDataUrl = stored;
            } else {
              subjImageUrl = cutout.dataUrl;
            }
          } catch (e) {
            console.warn("Failed to store cutout; using data URL", e?.message || e);
            subjImageUrl = cutout.dataUrl;
          }
        }
      } catch (e) {
        console.warn("Background removal failed; using original subject image", e?.message || e);
      }
    }
    // Pass the cutout (or original, if removal didn't run) into every
    // downstream consumer so analysis and rendering both see the same
    // image bytes.
    const subjectImageForGeneration = cleanedSubjectDataUrl || subjImageUrl || subjectImage;

    // Step 2-3: Extract context from reference and subject images (parallel)
    job.setStep(GenerationJobSteps.ANALYZE_REFERENCE);
    job.setStep(GenerationJobSteps.ANALYZE_SUBJECT);

    const [referenceContext, subjectContext] = await Promise.all([
      refImageUrl
        ? extractReferenceImageContext({ adminClient, imageUrl: refImageUrl })
        : Promise.resolve(null),
      subjImageUrl
        ? extractSubjectImageContext({ adminClient, imageUrl: subjImageUrl })
        : Promise.resolve(null),
    ]);
    const referenceContextText = formatReferenceContextForPrompt(referenceContext);
    const subjectContextText = formatSubjectContextForPrompt(subjectContext);

    // Step 4: Fetch background image. The pipeline tries cheap photo
    // providers (Unsplash / Pexels / Pixabay) first when one is configured
    // and only falls back to AI image generation if no provider is
    // available or every provider fails. The user-uploaded subject image,
    // when present, always wins — we never overwrite it with a stock photo.
    job.setStep(GenerationJobSteps.FETCH_BG_IMAGE);
    let aiBackgroundImage = null;
    let storedBackgroundImage = null;
    let aiBackgroundError = null;
    let aiBackgroundModel = null;

    if (!subjectImage) {
      const providerResult = await tryProviderBackground({
        adminClient,
        prompt,
        referenceContext,
        subjectContext,
      });
      if (providerResult?.dataUrl) {
        aiBackgroundImage = providerResult.dataUrl;
        aiBackgroundModel = {
          modelId: providerResult.providerName,
          modelLabel: providerResult.providerName,
          provider: providerResult.source,
          credit: providerResult.credit,
        };
      } else if (providerResult?.error) {
        aiBackgroundError = providerResult.error;
      }

      if (!aiBackgroundImage) {
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
            // Once we have an AI image, the provider error (if any) is
            // no longer relevant — clear it so the UI doesn't show a
            // confusing "stock photo failed" warning beside a working bg.
            aiBackgroundError = null;
          } else if (result?.error) {
            aiBackgroundError = result.error;
          }
        }
      }

      if (aiBackgroundImage && aiBackgroundImage.startsWith("data:")) {
        storedBackgroundImage = await storeBannerImageAsset({
          dataUrl: aiBackgroundImage,
          userId,
          jobId: job.jobId,
        }).catch(() => null);
        if (storedBackgroundImage) {
          aiBackgroundImage = storedBackgroundImage;
        }
      }
    }

    // Step 5: Generate from all enabled models in parallel
    job.setStep(GenerationJobSteps.PARALLEL_MODELS);

    // Resolve which models to use
    let usable;
    if (modelRef && modelRef !== "auto") {
      const picked = await getEnabledTextModelByRefWithSecrets(adminClient, modelRef);
      if (!picked) {
        throw new Error("Selected model is not enabled");
      }
      if (!pickApiKey(picked)) {
        throw new Error(`Model "${picked.label}" has no API key configured`);
      }
      usable = [picked];
    } else {
      const allModels = await listEnabledTextModelsWithSecrets(adminClient);
      usable = allModels.filter((m) => pickApiKey(m));
    }

    // Build work plan
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

    // Generate all variants in parallel
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

    const modelErrors = [];
    if (aiBackgroundError) {
      modelErrors.push({
        modelId: null,
        modelLabel: "image-bg",
        reason: aiBackgroundError,
      });
    }

    const variants = settled.map((s, i) => {
      const planned = plan[i];
      if (s.status === "fulfilled") {
        const t = s.value;
        if (t?.generator === "fallback" && t?.reason && planned.model) {
          modelErrors.push({
            modelId: planned.model.modelId,
            modelLabel: planned.model.label,
            reason: t.reason,
          });
        }
        return t;
      }
      modelErrors.push({
        modelId: planned.model?.modelId || null,
        modelLabel: planned.model?.label || "fallback",
        reason: s.reason?.message || "Unknown error",
      });
      return null;
    });

    const usableVariants = variants.filter(Boolean);
    if (usableVariants.length === 0) {
      throw new Error("Failed to generate any banner variants");
    }

    // Step 6: Score all banners
    job.setStep(GenerationJobSteps.SCORE_BANNERS);
    const scored = await Promise.all(
      usableVariants.map(async (t) => {
        const s = await scoreBannerTemplate({
          supabase,
          prompt,
          style,
          aspect,
          html: t.html || "",
          css: t.css || "",
        });
        return {
          template: t,
          score: s.score,
          scoreSource: s.source,
          scoreReason: s.reason,
        };
      }),
    );

    const ranked = [...scored].sort((a, b) => b.score - a.score);
    const passing = ranked.filter((v) => v.score >= SCORE_THRESHOLD);
    const winner = passing[0] || ranked[0];

    if (!winner) {
      throw new Error("Failed to score banner variants");
    }

    const template = winner.template;

    // Step 7: Save to database
    job.setStep(GenerationJobSteps.SAVE_BANNER);

    const modelsForRun = plan.map((p) => p.model?.modelId).filter(Boolean);
    const { data: runRow, error: runErr } = await supabase
      .from("generation_runs")
      .insert({
        user_id: userId,
        prompt,
        aspect,
        style,
        models: modelsForRun.length ? modelsForRun : ["fallback"],
        reference_image_url: refImageUrl || null,
        reference_context: referenceContext || null,
        subject_image_url: subjImageUrl || null,
        subject_context: subjectContext || null,
      })
      .select("id")
      .single();

    if (runErr) {
      throw new Error(`Failed to save generation run: ${runErr.message}`);
    }

    const runId = runRow.id;

    const resultRowsInput = scored.map((v) => {
      const imageField = (v.template?.fields || []).find(
        (f) => f?.type === "image" && f.id === "bg_image",
      );
      const imageUrl = imageField?.value || null;
      return {
        run_id: runId,
        user_id: userId,
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
      throw new Error(`Failed to save generation results: ${resultsErr.message}`);
    }

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
        user_id: userId,
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
        reference_image_url: referenceImage || null,
        reference_context: referenceContext || null,
        subject_image_url: subjectImage || null,
        subject_context: subjectContext || null,
      };
    });

    const { data: savedBanners, error: bannersErr } = await supabase
      .from("banners")
      .insert(bannerRows)
      .select("id, title, model_label, score");

    if (bannersErr || !savedBanners?.length) {
      throw new Error(`Failed to save banners: ${bannersErr?.message || "Unknown error"}`);
    }

    const rankedBanners = [...savedBanners].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const winnerBanner = rankedBanners.find((b) => b.model_label === (template.generator || "fallback") && b.score === winner.score) || rankedBanners[0];

    job.results = {
      referenceContext,
      subjectContext,
      backgroundImage: aiBackgroundImage,
      backgroundModel: aiBackgroundModel,
      backgroundImageUrl: storedBackgroundImage,
      modelErrors,
      passedThreshold: winner.score >= SCORE_THRESHOLD,
      score: winner.score,
    };

    // Complete job with results
    job.setBanner(winnerBanner, runId, rankedBanners, scored.map((v) => ({
      score: v.score,
      generator: v.template.generator,
      modelId: v.template.modelId || null,
      provider: v.template.provider || null,
    })));
  } catch (error) {
    console.error(`[Job ${job.jobId}] Generation failed:`, error);
    job.setError(error.message, error.stack);
  }
}

// Resolve a search category from the subject vision context, the
// reference vision context, or — failing both — heuristics over the
// raw prompt. Used to query stock-photo providers with a relevant term.
function resolveBackgroundQuery({ prompt, referenceContext, subjectContext }) {
  const subjectsToFeature = referenceContext?.subjectsToFeature || [];
  const subjectDesc = subjectContext?.shortDescription || "";
  const refSubject = referenceContext?.subject || "";
  const category =
    subjectContext?.subjectType ||
    referenceContext?.category ||
    extractCategoryFromPrompt(prompt) ||
    "abstract";
  const queryParts = [
    refSubject,
    subjectDesc,
    subjectsToFeature.slice(0, 2).join(" "),
    String(prompt || "").slice(0, 80),
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  const query = queryParts.join(" ").slice(0, 200) || category;
  return { category, query };
}

function extractCategoryFromPrompt(prompt) {
  const buckets = {
    tech: /\b(tech|software|app|ai|digital|saas|cloud|data|cyber)\b/i,
    food: /\b(food|restaurant|cafe|menu|recipe|cuisine|drink)\b/i,
    travel: /\b(travel|tour|destination|vacation|holiday|trip)\b/i,
    fashion: /\b(fashion|clothing|apparel|style|outfit|wear)\b/i,
    fitness: /\b(fitness|gym|workout|yoga|running|sport)\b/i,
    business: /\b(business|corporate|finance|office|enterprise|startup)\b/i,
    nature: /\b(nature|forest|mountain|ocean|landscape|wildlife)\b/i,
    art: /\b(art|gallery|exhibit|design|creative|illustration)\b/i,
    product: /\b(product|launch|release|announcement|preview)\b/i,
  };
  for (const [cat, re] of Object.entries(buckets)) {
    if (re.test(String(prompt || ""))) return cat;
  }
  return "abstract";
}

// Best-effort provider fetch. Walks every enabled provider in the order
// returned by the DB (admins control priority via `enabled` + insertion
// order) and inlines the first successful result as a data URI. Any
// provider that errors is skipped — the next one tries. Returns null
// when no providers are configured.
async function tryProviderBackground({
  adminClient,
  prompt,
  referenceContext,
  subjectContext,
}) {
  let providers;
  try {
    providers = await listBgImageProviders(adminClient);
  } catch (e) {
    return { dataUrl: null, error: `Failed to list providers: ${e.message}` };
  }
  if (!providers || providers.length === 0) return null;

  const { category, query } = resolveBackgroundQuery({
    prompt,
    referenceContext,
    subjectContext,
  });

  let lastError = null;
  for (const provider of providers) {
    try {
      const imageData = await fetchBgImageFromProvider(provider, category, query);
      if (!imageData?.url) continue;
      const dataUrl = imageData.url.startsWith("http")
        ? await urlToBase64(imageData.url)
        : imageData.url;
      return {
        dataUrl,
        providerName: provider.name,
        source: imageData.source || provider.type,
        credit: imageData.credit || null,
      };
    } catch (e) {
      lastError = e?.message || String(e);
      continue;
    }
  }
  return { dataUrl: null, error: lastError || "All providers failed" };
}
