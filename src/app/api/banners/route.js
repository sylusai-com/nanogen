// src/app/api/banners/route.js
// src/app/api/banners/route.js
// Banner generation endpoint - returns immediately with jobId for polling
// Actual generation happens in background, tracked via /api/generation-status/[jobId]

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyLayeredImages,
  applySubjectImage,
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
  pickBestTextModelWithSecrets,
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
import { buildBackgroundQuery } from "@/lib/bgQuery";
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
import {
  enhancePrompt,
  detectCategoryAndStyle,
} from "@/lib/bannerGeneration";

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
  let prompt, style, aspect, referenceImage, subjectImage, modelRef, regenerateFromId;
  // Carry forward the prior banner's vision-analysis outputs when this
  // is a regeneration with the same reference/subject images. Skips the
  // vision-model calls (≈2-4s each) and the bg-removal call (≈3-5s) —
  // those produced deterministic outputs from the same inputs last time
  // and re-running them just burns wall-clock time on a click the user
  // wants to feel snappy. Bg image is NOT carried forward: the prompt
  // change is likely to want a different look.
  let priorReferenceContext = null;
  let priorSubjectContext = null;
  let priorSubjectCutoutUrl = null;
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

    // Regenerate flow: load prior banner context. The user's `prompt` in
    // this mode describes the *changes* they want, not the original
    // brief. We fold both into a combined brief so the model has full
    // context: "Original brief: <prior>. Apply these changes: <new>."
    regenerateFromId = validateString(body.regenerateFromId, { name: "regenerateFromId", max: 80 }) || null;
    if (regenerateFromId) {
      const { data: prior } = await supabase
        .from("banners")
        .select("id, prompt, style, aspect, reference_image_url, reference_context, subject_image_url, fields")
        .eq("id", regenerateFromId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (prior) {
        if (!style) style = prior.style || null;
        if (!body.aspect) aspect = prior.aspect || aspect;
        if (!referenceImage && prior.reference_image_url) {
          referenceImage = prior.reference_image_url;
          // Same reference image → previously-extracted context still
          // applies. Reuse it and skip the vision call later.
          priorReferenceContext = prior.reference_context || null;
        }
        if (!subjectImage && prior.subject_image_url) {
          subjectImage = prior.subject_image_url;
          priorSubjectContext = prior.subject_context || null;
          // The cutout from last generation lives on the previous
          // banner's `subject_image` field. If it's still a usable URL
          // we hand it forward so removeSubjectBackground (3-5s) can be
          // skipped this round.
          const subjField = Array.isArray(prior.fields)
            ? prior.fields.find((f) => f?.id === "subject_image")
            : null;
          const raw = String(subjField?.value || "").trim();
          const m = raw.match(/^url\(\s*["']?(.*?)["']?\s*\)$/i);
          const inner = (m ? m[1] : raw).trim();
          if (/^(?:https?:\/\/|data:image\/)/i.test(inner)) {
            priorSubjectCutoutUrl = inner;
          }
        }
        const changeRequest = prompt;
        const originalBrief = String(prior.prompt || "").trim();
        if (originalBrief) {
          // Strip any prior regeneration framing from the saved brief so
          // it doesn't compound across regenerations (chains of
          // "ORIGINAL BRIEF: ORIGINAL BRIEF: …" pollute the prompt).
          const cleanOriginal = originalBrief
            .replace(/^ORIGINAL BRIEF:\s*/i, "")
            .replace(/\n+REGENERATION INSTRUCTIONS[^]*$/i, "")
            .trim();
          // Compact format. The previous wrapper read like an editing
          // task ("apply these changes while keeping the original
          // intent") and models — especially on 1:1 — interpreted it as
          // "tweak the existing layout", producing tiny centered
          // content with large empty bands. This version reads as a
          // SINGLE fresh-banner brief with an explicit emphasis on the
          // change, so the per-aspect guidance in the system prompt
          // ("inner content fills nearly the full width") still kicks
          // in and the canvas is filled.
          prompt = `${cleanOriginal}\n\nUPDATED DIRECTION (apply these and produce a complete, fresh banner that fills the full ${aspect} canvas): ${changeRequest}`.slice(0, 4000);
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
      // Regenerate-only short-circuits — null on a fresh create.
      priorReferenceContext,
      priorSubjectContext,
      priorSubjectCutoutUrl,
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
  const {
    prompt, style, aspect, referenceImage, subjectImage, modelRef,
    priorReferenceContext = null,
    priorSubjectContext = null,
    priorSubjectCutoutUrl = null,
  } = payload;

  try {
    // Step 1: Validate images exist and are accessible
    job.setStep(GenerationJobSteps.UPLOAD_IMAGES);
    // (Image URLs are already validated in POST handler)

    // If the client provided data URLs for reference/subject, store them
    // server-side and replace with the public URL before analysis. This
    // keeps the base64 data for model analysis ephemeral while the
    // banner saves reference to a stable stored URL.
    // Storage uploads for the reference + subject images run in parallel:
    // both hit the same bucket independently and there's no ordering
    // requirement. The "store" step swaps a giant data URI for a
    // permanent HTTPS URL we can hand to vision models cheaply.
    let refImageUrl = referenceImage;
    let subjImageUrl = subjectImage;
    // Falling back to a data URI keeps the pipeline working but persists a
    // multi-hundred-KB base64 blob in the banner row, which slows the
    // dashboard and editor. The most common cause is the `banner-images`
    // bucket not existing — point future-me at the migration so the fix
    // is obvious.
    const onStoreFail = (which) => (e) => {
      const msg = e?.message || String(e);
      const hint = /bucket not found/i.test(msg)
        ? " (apply supabase/migrations/0014_banner_images_bucket.sql to create it)"
        : "";
      console.warn(`Failed to store ${which} image; continuing with data URL: ${msg}${hint}`);
    };
    const storageJobs = [];
    if (refImageUrl && typeof refImageUrl === "string" && refImageUrl.startsWith("data:image/")) {
      storageJobs.push(
        storeBannerImageAsset({ dataUrl: refImageUrl, userId, bannerId: null, jobId: job.jobId, adminClient, kind: "reference" })
          .then((stored) => { if (stored) refImageUrl = stored; })
          .catch(onStoreFail("reference")),
      );
    }
    if (subjImageUrl && typeof subjImageUrl === "string" && subjImageUrl.startsWith("data:image/")) {
      storageJobs.push(
        storeBannerImageAsset({ dataUrl: subjImageUrl, userId, bannerId: null, jobId: job.jobId, adminClient, kind: "subject" })
          .then((stored) => { if (stored) subjImageUrl = stored; })
          .catch(onStoreFail("subject")),
      );
    }
    if (storageJobs.length) await Promise.all(storageJobs);

    // Steps 1b / 2 / 3 all run in parallel — they read the now-stored
    // image URLs but don't depend on each other:
    //   • Reference vision analysis (palette / mood / motifs)
    //   • Subject vision analysis (subject type / framing / placement)
    //   • Subject background removal (provider chain → local fallback)
    // Running them concurrently shaves the longest-pole request off
    // the wall-clock time, which matters because each call is ~2-4s.
    // Each analysis is only run when its image was actually uploaded. The
    // unused step is marked skipped (rendered as a strike-through cross on
    // the timeline) so the user can see the pipeline didn't stall — it
    // just had nothing to analyse.
    // Regenerate short-circuits — when the prior banner already analysed
    // THIS reference / subject we reuse those outputs and skip the vision
    // calls + bg-removal. Cuts ~5-9s off a typical regenerate where the
    // user only wanted prompt/style tweaks. Each reused step is recorded
    // as a SKIPPED step (with "reused from previous generation" reason)
    // so the popup timeline shows what was bypassed and why.
    const reuseReference = !!(refImageUrl && priorReferenceContext);
    const reuseSubjectContext = !!(subjImageUrl && priorSubjectContext);
    const reuseSubjectCutout = !!(subjImageUrl && priorSubjectCutoutUrl);

    if (!refImageUrl) {
      job.markStepSkipped(GenerationJobSteps.ANALYZE_REFERENCE, "no reference image uploaded");
    } else if (reuseReference) {
      job.markStepSkipped(GenerationJobSteps.ANALYZE_REFERENCE, "reused from previous generation");
    } else {
      job.setStep(GenerationJobSteps.ANALYZE_REFERENCE);
    }
    if (!subjImageUrl) {
      job.markStepSkipped(GenerationJobSteps.ANALYZE_SUBJECT, "no subject image uploaded");
    } else if (reuseSubjectContext) {
      job.markStepSkipped(GenerationJobSteps.ANALYZE_SUBJECT, "reused from previous generation");
    } else {
      job.setStep(GenerationJobSteps.ANALYZE_SUBJECT);
    }

    const [referenceContext, subjectContext, cutoutResult] = await Promise.all([
      reuseReference
        ? Promise.resolve(priorReferenceContext)
        : refImageUrl
          ? extractReferenceImageContext({ adminClient, imageUrl: refImageUrl })
          : Promise.resolve(null),
      reuseSubjectContext
        ? Promise.resolve(priorSubjectContext)
        : subjImageUrl
          ? extractSubjectImageContext({ adminClient, imageUrl: subjImageUrl })
          : Promise.resolve(null),
      reuseSubjectCutout
        ? Promise.resolve({ dataUrl: priorSubjectCutoutUrl, reused: true })
        : subjImageUrl
          ? removeSubjectBackground(subjImageUrl, { adminClient }).catch((e) => {
              console.warn("Background removal failed; using original subject image", e?.message || e);
              return null;
            })
          : Promise.resolve(null),
    ]);
    const referenceContextText = formatReferenceContextForPrompt(referenceContext);
    const subjectContextText = formatSubjectContextForPrompt(subjectContext);

    // Step 2b: Enhance the brief using both contexts. One LLM call rewrites
    // the user's prompt with the reference image's mood/palette/motifs and
    // the subject image's framing/placement, AND returns the placement
    // decision (where the subject sits, whether to reserve clean space).
    // Best-effort — falls back to the original prompt if the model is
    // unavailable. The enriched brief flows into both the bg-prompt and
    // the per-model generation calls below so every stage sees the same
    // composition guidance.
    job.setStep(GenerationJobSteps.ENHANCE_PROMPT);
    const enhancement = await enhancePrompt({
      adminClient,
      userPrompt: prompt,
      aspectRatio: aspect,
      style,
      referenceContext,
      subjectContext,
    });
    const enhancedBrief = enhancement.brief || prompt;
    const placedSubjectContext = subjectContext
      ? { ...subjectContext, placement: enhancement.placement || subjectContext.placement }
      : null;
    const placedSubjectContextText = formatSubjectContextForPrompt(placedSubjectContext);

    // Persist the cutout (when one was produced) for use in rendering.
    // IMPORTANT: do NOT overwrite `subjImageUrl` with the cutout — that
    // variable still represents the user's ORIGINAL upload and is saved
    // verbatim as `subject_image_url` on the banner row so the editor's
    // Reference / Subject card shows what they actually uploaded, not the
    // transparent cutout. The cutout lives only in `cleanedSubjectStoredUrl`
    // and flows through `subjectImageForGeneration` into the rendered
    // bg_image / subject_image fields.
    let cleanedSubjectStoredUrl = null;
    if (cutoutResult?.reused) {
      // Regenerate path — the prior banner's cutout URL is already a
      // Supabase-hosted asset; re-uploading would just waste cycles and
      // multiply storage rows. Use the URL as-is.
      cleanedSubjectStoredUrl = cutoutResult.dataUrl;
    } else if (cutoutResult?.dataUrl) {
      try {
        const stored = await storeBannerImageAsset({
          dataUrl: cutoutResult.dataUrl,
          userId,
          jobId: job.jobId,
          adminClient,
          kind: "subject-cutout",
        });
        cleanedSubjectStoredUrl = stored || cutoutResult.dataUrl;
      } catch (e) {
        console.warn("Failed to store cutout; using data URL", e?.message || e);
        cleanedSubjectStoredUrl = cutoutResult.dataUrl;
      }
    }
    const subjectImageForGeneration = cleanedSubjectStoredUrl || subjImageUrl || subjectImage;

    // Photographic background fetching has MOVED to after model generation
    // and category detection (see "Step 6c" below). The text model writes
    // a CSS-only banner first; only once we know the detected category /
    // style do we query admin-configured providers and (if they fail) the
    // AI image model. If neither produces a usable image, the banner
    // ships with the model's own CSS design intact.
    let aiBackgroundImage = null;
    let storedBackgroundImage = null;
    let aiBackgroundError = null;
    let aiBackgroundModel = null;

    // Step 5: Generate from all enabled models in parallel
    job.setStep(GenerationJobSteps.PARALLEL_MODELS);

    // Resolve which models to use. "auto" no longer fans out across every
    // enabled model — instead we pick the single best-scoring model
    // based on historical generation_results, and only fall back to the
    // full fan-out when there is no usable history yet.
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
      const best = await pickBestTextModelWithSecrets(adminClient).catch(() => null);
      if (best && pickApiKey(best)) {
        usable = [best];
      } else {
        const allModels = await listEnabledTextModelsWithSecrets(adminClient);
        usable = allModels.filter((m) => pickApiKey(m));
      }
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

    // Generate all variants in parallel. Pass the cleaned cutout (when
    // bg-removal succeeded) so analysis and rendering use the same
    // bytes; fall back to the stored subject URL otherwise.
    // Generate without a photographic backgroundImage — every text model
    // emits its own CSS-only background first. If the bg-fetch step below
    // returns a usable image, we layer it onto the WINNER post-hoc; if it
    // doesn't, the model's design ships unchanged.
    const settled = await Promise.allSettled(
      plan.map(({ model, variantSeed }) =>
        generateBannerTemplate({
          supabase,
          prompt: enhancedBrief,
          style,
          aspect,
          variantSeed,
          textModel: model,
          referenceContextText,
          subjectContextText: placedSubjectContextText || subjectContextText,
          subjectImage: subjectImageForGeneration,
          backgroundImage: null,
        }),
      ),
    );

    const modelErrors = [];

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

    // Step 6b: Classify the winning banner. Runs on the highest-scoring
    // candidate's HTML/CSS so the metadata reflects what the user will
    // actually see. Persisted alongside the banner row so dashboards and
    // future regenerations can filter / theme by category/style/mood.
    // Best-effort — empty defaults when the model is unavailable.
    job.setStep(GenerationJobSteps.DETECT_CATEGORY);
    const detection = await detectCategoryAndStyle({
      adminClient,
      brief: enhancedBrief,
      referenceContext,
      subjectContext: placedSubjectContext,
      sampleBanner: { html: template.html, css: template.css },
    });

    // Step 6c: Fetch a photographic background NOW (after the model has
    // shown what it wants and the classifier has labelled the result).
    // Order of attempts:
    //   1. Admin-configured stock providers from /admin/bg-image-providers
    //      — Unsplash, Pexels, Pixabay, etc. — queried with the LLM-built
    //      search phrase and the detected category. Tried in DB order;
    //      first hit wins.
    //   2. AI image-generation fallback (image models from /admin/models)
    //      with the enriched brief + detected style.
    // If nothing returns a usable image, fetch_bg_image is marked SKIPPED
    // and the winner ships with its CSS-only background untouched.
    //
    // We do NOT fetch a bg when the user supplied a subject image whose
    // background was not removed — the subject already carries its own
    // scene and a stock photo behind it would clash.
    const subjectIsCutout = !!cleanedSubjectStoredUrl;
    const shouldFetchBg = !subjectImage || subjectIsCutout;

    if (shouldFetchBg) {
      job.setStep(GenerationJobSteps.FETCH_BG_IMAGE);

      const [bgQuery, providersList, imageModelList] = await Promise.all([
        buildBackgroundQuery({
          adminClient,
          brief: enhancedBrief,
          referenceContext,
          subjectContext: placedSubjectContext,
        }).then((q) => ({
          ...q,
          // Prefer the detector's category over the bg-query LLM's guess —
          // the detector has the rendered HTML/CSS as evidence, the query
          // LLM only has the brief.
          category: detection.category && detection.category !== "other"
            ? detection.category
            : q.category,
        })),
        listBgImageProviders(adminClient).catch(() => []),
        listImageModelsWithSecrets(adminClient).catch(() => []),
      ]);

      // 1. Admin-configured stock providers.
      const providerResult = await tryProviderBackground({
        providers: providersList,
        category: bgQuery.category,
        query: bgQuery.query,
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

      // 2. AI image-gen fallback (only if no provider returned an image).
      if (!aiBackgroundImage) {
        const imageModel = imageModelList.find((m) => pickApiKey(m)) || null;
        if (imageModel) {
          const result = await generateBannerBackground({
            imageModel,
            brief: enhancedBrief,
            style: style || detection.style || null,
            aspect,
            referenceContext,
            subjectContext: placedSubjectContext,
          });
          if (result?.dataUrl) {
            aiBackgroundImage = result.dataUrl;
            aiBackgroundModel = {
              modelId: result.modelId,
              modelLabel: result.modelLabel,
              provider: result.provider,
            };
            aiBackgroundError = null;
          } else if (result?.error) {
            aiBackgroundError = result.error;
          }
        }
      }

      // Inline data URIs are heavy in DB rows and cache layers; store the
      // image in Supabase storage and swap to the public URL.
      if (aiBackgroundImage && aiBackgroundImage.startsWith("data:")) {
        storedBackgroundImage = await storeBannerImageAsset({
          dataUrl: aiBackgroundImage,
          userId,
          jobId: job.jobId,
          adminClient,
          kind: "bg",
        }).catch(() => null);
        if (storedBackgroundImage) {
          aiBackgroundImage = storedBackgroundImage;
        }
      }

      if (!aiBackgroundImage) {
        job.markStepSkipped(
          GenerationJobSteps.FETCH_BG_IMAGE,
          aiBackgroundError || "no provider or image model produced a background",
        );
        if (aiBackgroundError) {
          modelErrors.push({
            modelId: null,
            modelLabel: "image-bg",
            reason: aiBackgroundError,
          });
        }
      }
    } else {
      job.markStepSkipped(
        GenerationJobSteps.FETCH_BG_IMAGE,
        "subject image already provides a full background",
      );
    }

    // If the fetch succeeded, layer the bg onto the WINNER template only
    // (other candidates stay as-is — they're cheap variants kept for the
    // user to inspect). When a subject is also present we route bg →
    // bg_image and subject → subject_image via applyLayeredImages; when
    // there is no subject we route bg → bg_image via applySubjectImage.
    let appliedTemplate = template;
    if (aiBackgroundImage) {
      const hasSubject = !!subjectImageForGeneration;
      appliedTemplate = hasSubject
        ? applyLayeredImages(template, {
            backgroundImage: aiBackgroundImage,
            subjectImage: subjectImageForGeneration,
          })
        : applySubjectImage(template, aiBackgroundImage);
      // Keep the winner reference in sync so all downstream writes see the
      // mutated fields/css/html.
      winner.template = appliedTemplate;
    }

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
        reference_image_url: refImageUrl || referenceImage || null,
        reference_context: referenceContext || null,
        // Persist the user's ORIGINAL upload (never the cutout). The
        // ReferencePanel + edit page show this URL directly to the user
        // as their "Subject image" thumbnail, so it must match what they
        // actually picked from disk. The cleaned cutout lives only in
        // the banner's subject_image field for rendering — never here.
        subject_image_url: subjImageUrl || subjectImage || null,
        subject_context: subjectContext || null,
      };
    });

    // Select the full renderable banner shape (html/css/fields/alignment
    // /aspect) so the floating GenerationPopup can show the actual
    // generated banner in place of the skeleton the moment the job
    // completes — rather than waiting for the dashboard to refetch.
    const { data: savedBanners, error: bannersErr } = await supabase
      .from("banners")
      .insert(bannerRows)
      .select("id, title, model_label, score, html, css, fields, alignment, aspect, preview_gradient, image_url, subject_image_url");

    if (bannersErr || !savedBanners?.length) {
      throw new Error(`Failed to save banners: ${bannersErr?.message || "Unknown error"}`);
    }

    const rankedBanners = [...savedBanners].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const winnerBanner = rankedBanners.find((b) => b.model_label === (template.generator || "fallback") && b.score === winner.score) || rankedBanners[0];

    // `usedFallback` reflects the underlying truth users care about: did
    // the LLM actually generate this banner, or did we ship the static
    // built-in fallback template because the model call failed? The old
    // `passedThreshold` (winner.score >= 80) was conflating two very
    // different states — a perfectly good model output that scored 75
    // was triggering the same "we couldn't reach the AI" warning as a
    // genuine fallback. Now both flags ship and the client decides what
    // to surface: only `usedFallback` warrants the user-facing warning.
    const winnerUsedFallback = (winner.template?.generator || "").toLowerCase() === "fallback";
    job.results = {
      referenceContext,
      subjectContext,
      backgroundImage: aiBackgroundImage,
      backgroundModel: aiBackgroundModel,
      backgroundImageUrl: storedBackgroundImage,
      modelErrors,
      usedFallback: winnerUsedFallback,
      passedThreshold: winner.score >= SCORE_THRESHOLD,
      score: winner.score,
      enhancement: {
        brief: enhancedBrief,
        reserveSpace: enhancement.reserveSpace,
        placement: enhancement.placement,
        reasoning: enhancement.reasoning,
      },
      detection,
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

// Walks every enabled provider in the order returned by the DB (admins
// control priority via `enabled` + insertion order) and inlines the
// first successful result as a data URI. Any provider that errors is
// skipped — the next one tries. Returns null when no providers are
// passed in. The provider list and the search query/category are
// produced upstream in parallel; this function does only the actual
// vendor calls.
async function tryProviderBackground({ providers, category, query }) {
  if (!providers || providers.length === 0) return null;

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
