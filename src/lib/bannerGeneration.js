// src/lib/bannerGeneration.js
//
// Isolated banner-generation orchestrator. Implements the seven-stage spec:
//
//   1. Input handling          — validate prompt / aspect / images / models
//   2. Parallel image analysis — extractReference + extractSubject in parallel
//   3. Prompt enhancement      — LLM rewrites the brief using both contexts
//   4. Subject placement       — emitted alongside the enhanced brief
//   5. Banner generation       — fan-out across text models via composeBannerMessages
//   6. Category & style        — post-generation classification
//   7. Background (optional)   — generateBannerBackground when needed
//
// Scoring and DB persistence are LEFT TO THE CALLER. This module returns
// the candidates + context + detection + optional background so a route
// can decide how to score, persist, and shape the response.
//
// Best-effort stages (analysis, enhancement, detection, background) all
// degrade gracefully to deterministic fallbacks when the LLM is missing
// or returns junk. The only hard failures are missing required inputs
// and "all text models failed to produce a candidate".

import { callOpenRouter, extractJson } from "@/lib/openrouter";
import { GenerationJobSteps } from "@/lib/generationQueue";
import {
  extractReferenceImageContext,
  extractSubjectImageContext,
  formatReferenceContextForPrompt,
  formatSubjectContextForPrompt,
} from "@/lib/referenceImage";
import { composeBannerMessages, getActivePrompts } from "@/lib/prompts";
import { generateBannerBackground } from "@/lib/imageGen";
import { pickApiKey, pickEndpoint } from "@/lib/bannerTemplate";
import { getDefaultTextModelWithSecrets } from "@/lib/db/models";

export { GenerationJobSteps as GenerationSteps };

// Top-level orchestrator.
//
// `models` is an array of model rows (already loaded with secrets) — the
// caller is responsible for resolving them so this module stays decoupled
// from DB shape. `imageModel` is optional; supply it to enable AI background
// generation in step 7.
//
// `onProgress(step)` and `job.setStep(step)` are both supported; pass
// whichever your caller already speaks. Either may be omitted.
export async function generateBannerSequentially(
  {
    prompt,
    referenceImageUrl = null,
    subjectImageUrl = null,
    aspectRatio,
    style = null,
    models,
    imageModel = null,
    supabase = null,
    adminClient,
    userId = null,
  },
  onProgress = null,
  job = null,
) {
  // ── Step 1: input handling ──────────────────────────────────────────────
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new Error("prompt is required");
  }
  if (!Array.isArray(models) || models.length === 0) {
    throw new Error("at least one model is required");
  }
  if (!adminClient) {
    throw new Error("adminClient is required (used for vision and prompt loading)");
  }

  setStep(onProgress, job, GenerationJobSteps.UPLOAD_IMAGES);
  const [referenceImage, subjectImage] = await Promise.all([
    referenceImageUrl ? validateImageUrl(referenceImageUrl) : Promise.resolve(null),
    subjectImageUrl   ? validateImageUrl(subjectImageUrl)   : Promise.resolve(null),
  ]);
  setResult(job, { referenceImage, subjectImage });

  // ── Step 2: parallel image analysis ────────────────────────────────────
  setStep(onProgress, job, GenerationJobSteps.ANALYZE_REFERENCE);
  const [referenceContext, subjectContext] = await Promise.all([
    referenceImageUrl
      ? extractReferenceImageContext({ adminClient, imageUrl: referenceImageUrl }).catch(() => null)
      : Promise.resolve(null),
    subjectImageUrl
      ? extractSubjectImageContext({ adminClient, imageUrl: subjectImageUrl }).catch(() => null)
      : Promise.resolve(null),
  ]);
  setStep(onProgress, job, GenerationJobSteps.ANALYZE_SUBJECT);
  setResult(job, { referenceContext, subjectContext });

  // ── Step 3 + 4: intelligent prompt enhancement + placement decision ────
  setStep(onProgress, job, GenerationJobSteps.ENHANCE_PROMPT);
  const enhancement = await enhancePrompt({
    adminClient,
    userPrompt: prompt,
    aspectRatio,
    style,
    referenceContext,
    subjectContext,
  });
  setResult(job, { enhancement });

  // The placement decision flows into TWO places:
  //   (a) the subject context handed to the text model (so headline / CTAs
  //       avoid the subject's focal area)
  //   (b) the image-gen call below (so the AI background reserves negative
  //       space on the correct side)
  const placedSubjectContext = subjectContext
    ? { ...subjectContext, placement: enhancement.placement || subjectContext.placement }
    : null;

  // ── Step 5: banner generation (parallel across text models) ────────────
  setStep(onProgress, job, GenerationJobSteps.PARALLEL_MODELS);
  const prompts = await getActivePrompts(adminClient);

  const settled = await Promise.all(
    models.map((m) =>
      generateFromTextModel({
        modelRow: m,
        prompts,
        brief: enhancement.brief,
        style,
        aspect: aspectRatio,
        referenceContext,
        subjectContext: placedSubjectContext,
      }).catch((err) => ({
        error: err?.message || String(err),
        modelSlug: m.slug,
        modelLabel: m.label,
      })),
    ),
  );

  const candidates = settled.filter((r) => !r.error);
  const modelErrors = settled.filter((r) => r.error);
  if (candidates.length === 0) {
    const first = modelErrors[0]?.error || "all text models failed";
    throw new Error(`Banner generation failed: ${first}`);
  }
  setResult(job, { candidates, modelErrors });

  // ── Step 6: category & style detection ─────────────────────────────────
  setStep(onProgress, job, GenerationJobSteps.DETECT_CATEGORY);
  const detection = await detectCategoryAndStyle({
    adminClient,
    brief: enhancement.brief,
    referenceContext,
    subjectContext,
    sampleBanner: candidates[0],
  });
  setResult(job, { detection });

  // ── Step 7: optional background generation ─────────────────────────────
  // Generate ONLY when both the brief and the detector agree that an
  // external photographic background would improve the result, AND the
  // caller has supplied an image model. Otherwise the CSS-only background
  // emitted by the text model carries the design — saves a provider call
  // and avoids overwriting an already-coherent banner.
  let background = null;
  const shouldGenerateBackground =
    !!imageModel &&
    (enhancement.needsBackground || detection.needsExternalBackground);

  if (shouldGenerateBackground) {
    setStep(onProgress, job, GenerationJobSteps.GENERATE_BACKGROUND);
    const result = await generateBannerBackground({
      imageModel,
      brief: enhancement.brief,
      style: style || detection.style || null,
      aspect: aspectRatio,
      referenceContext,
      subjectContext: placedSubjectContext,
    });
    background = result?.dataUrl ? result : null;
    setResult(job, { background });
  }

  return {
    success: true,
    enhancedPrompt: enhancement.brief,
    placement: {
      reserveSpace: enhancement.reserveSpace,
      placement: enhancement.placement,
      reasoning: enhancement.reasoning,
    },
    referenceContext,
    subjectContext: placedSubjectContext,
    detection,
    background,
    candidates,
    modelErrors,
    userId,
    supabase,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function setStep(onProgress, job, step) {
  if (typeof onProgress === "function") onProgress(step);
  if (job && typeof job.setStep === "function") job.setStep(step);
}

function setResult(job, patch) {
  if (job && job.results && typeof job.results === "object") {
    Object.assign(job.results, patch);
  }
}

// Data URIs are valid by construction (we control upload); only remote URLs
// get a HEAD probe so we fail fast on broken / forbidden hosts before
// spending tokens on vision analysis.
async function validateImageUrl(url) {
  if (typeof url !== "string" || !url) return null;
  if (url.startsWith("data:")) return { url, valid: true, dataUri: true };
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) throw new Error(`HEAD ${res.status}`);
    return {
      url,
      valid: true,
      size: res.headers.get("content-length"),
      type: res.headers.get("content-type"),
    };
  } catch (e) {
    throw new Error(`Invalid image URL: ${e.message}`);
  }
}

// Enrich brief + decide placement + decide whether to generate a background.
// One LLM call does all three so they stay consistent with each other.
const ENHANCE_SYSTEM = `You are a senior design director. Given a marketing-banner brief plus optional analyses of a reference image and a subject image, you do three things at once:

1. ENRICH the brief into a single tight paragraph (≤120 words) that:
   - keeps the user's stated intent intact (never contradict the user)
   - adds composition guidance pulled from the reference (mood, palette, motifs)
   - acknowledges the subject image (placement, framing, colors) when present
   - never invents facts not present in the inputs

2. DECIDE subject placement. If a subject image exists, pick where the subject sits and confirm clean space must be reserved for it. If no subject image exists, set reserveSpace=false and placement="none".

3. DECIDE whether an external photographic background should be generated. Set needsBackground=true ONLY when:
   - the brief mentions a real-world scene that benefits from photography (e.g. "sunset beach", "neon city street")
   - OR no reference image is provided AND the subject would benefit from a contextual environment
   Otherwise set needsBackground=false — CSS-only backgrounds carry the design.

Return ONLY this JSON:
{
  "brief":           string,
  "reserveSpace":    boolean,
  "placement":       "right-portrait" | "left-portrait" | "center-hero" | "bottom-band" | "background-fill" | "corner-accent" | "none",
  "needsBackground": boolean,
  "reasoning":       string
}`;

const VALID_PLACEMENTS = new Set([
  "right-portrait", "left-portrait", "center-hero",
  "bottom-band", "background-fill", "corner-accent", "none",
]);

async function enhancePrompt({
  adminClient,
  userPrompt,
  aspectRatio,
  style,
  referenceContext,
  subjectContext,
}) {
  const fallback = {
    brief: userPrompt,
    reserveSpace: !!subjectContext,
    placement: subjectContext?.placement || "none",
    needsBackground: !referenceContext && !!subjectContext,
    reasoning: "fallback heuristic — LLM unavailable",
  };

  const model = await getDefaultTextModelWithSecrets(adminClient).catch(() => null);
  if (!model) return fallback;
  const apiKey = pickApiKey(model);
  const endpoint = pickEndpoint(model);
  if (!apiKey) return fallback;
  if (!endpoint && model.provider !== "openrouter") return fallback;

  const userParts = [`USER PROMPT: ${userPrompt}`];
  if (aspectRatio) userParts.push(`ASPECT: ${aspectRatio}`);
  if (style)       userParts.push(`STYLE: ${style}`);
  const refBlock = formatReferenceContextForPrompt(referenceContext);
  const subBlock = formatSubjectContextForPrompt(subjectContext);
  if (refBlock) userParts.push(refBlock);
  if (subBlock) userParts.push(subBlock);

  try {
    const { content } = await callOpenRouter({
      apiKey,
      endpoint: endpoint || undefined,
      model: model.modelId,
      jsonMode: true,
      temperature: 0.4,
      maxTokens: 700,
      messages: [
        { role: "system", content: ENHANCE_SYSTEM },
        { role: "user",   content: userParts.join("\n\n") },
      ],
    });
    const parsed = extractJson(content);
    if (!parsed || typeof parsed !== "object" || typeof parsed.brief !== "string") {
      return fallback;
    }
    const placement = typeof parsed.placement === "string"
      ? parsed.placement.trim().toLowerCase()
      : "";
    return {
      brief: parsed.brief.trim().slice(0, 2000) || userPrompt,
      reserveSpace: !!parsed.reserveSpace,
      placement: VALID_PLACEMENTS.has(placement) ? placement : fallback.placement,
      needsBackground: !!parsed.needsBackground,
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning.slice(0, 240) : "",
    };
  } catch {
    return fallback;
  }
}

// One text-model invocation. Uses prompts.js's composeBannerMessages so the
// emitted HTML/CSS stays compatible with every downstream validator
// (data-slot, color contrast, bg_image field, etc.).
async function generateFromTextModel({
  modelRow,
  prompts,
  brief,
  style,
  aspect,
  referenceContext,
  subjectContext,
}) {
  const apiKey   = pickApiKey(modelRow);
  const endpoint = pickEndpoint(modelRow);
  if (!apiKey) {
    throw new Error(`No API key configured for model "${modelRow.label || modelRow.slug}"`);
  }

  const referenceContextText = formatReferenceContextForPrompt(referenceContext);
  const subjectContextText   = formatSubjectContextForPrompt(subjectContext);

  const messages = composeBannerMessages({
    prompts,
    brief,
    style,
    aspect,
    referenceContextText,
    subjectContextText,
  });

  const { content } = await callOpenRouter({
    apiKey,
    endpoint: endpoint || undefined,
    model: modelRow.modelId,
    jsonMode: true,
    temperature: 0.7,
    maxTokens: 4096,
    messages,
  });

  const parsed = extractJson(content);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Model "${modelRow.label || modelRow.slug}" returned invalid JSON`);
  }

  return {
    ...parsed,
    modelId:    modelRow.modelId,
    modelSlug:  modelRow.slug,
    modelLabel: modelRow.label,
    provider:   modelRow.provider,
  };
}

// Post-generation classifier. Reads brief + a sample candidate's HTML/CSS to
// produce metadata for the saved banner and to seed the background prompt.
const DETECT_SYSTEM = `You are a brand strategist classifying a generated marketing banner. Given the brief and (optionally) the rendered banner's HTML/CSS, return ONLY this JSON:

{
  "category": one of: "gaming" | "luxury" | "tech" | "fashion" | "sports" | "minimal" | "futuristic" | "cinematic" | "dark-aesthetic" | "abstract" | "promotional" | "event" | "product-focused" | "lifestyle" | "food" | "travel" | "fitness" | "business" | "nature" | "art" | "other",
  "theme":  string,
  "style":  string,
  "mood":   string[],
  "needsExternalBackground": boolean
}

needsExternalBackground=true ONLY when a photographic background image would meaningfully improve the banner (e.g. a real-world scene). If the HTML/CSS already shows a strong gradient/SVG composition, set it to false.`;

const VALID_CATEGORIES = new Set([
  "gaming", "luxury", "tech", "fashion", "sports", "minimal", "futuristic",
  "cinematic", "dark-aesthetic", "abstract", "promotional", "event",
  "product-focused", "lifestyle", "food", "travel", "fitness", "business",
  "nature", "art", "other",
]);

async function detectCategoryAndStyle({
  adminClient,
  brief,
  referenceContext,
  subjectContext,
  sampleBanner,
}) {
  const fallback = {
    category: referenceContext?.category || "other",
    theme: "",
    style: "",
    mood: Array.isArray(referenceContext?.mood) ? referenceContext.mood.slice(0, 4) : [],
    needsExternalBackground: false,
  };

  const model = await getDefaultTextModelWithSecrets(adminClient).catch(() => null);
  if (!model) return fallback;
  const apiKey = pickApiKey(model);
  const endpoint = pickEndpoint(model);
  if (!apiKey) return fallback;
  if (!endpoint && model.provider !== "openrouter") return fallback;

  const userBlock = [
    `BRIEF: ${brief}`,
    sampleBanner?.html ? `HTML:\n${String(sampleBanner.html).slice(0, 4000)}` : "",
    sampleBanner?.css  ? `CSS:\n${String(sampleBanner.css).slice(0, 4000)}`   : "",
    subjectContext?.subjectType ? `SUBJECT TYPE: ${subjectContext.subjectType}` : "",
  ].filter(Boolean).join("\n\n");

  try {
    const { content } = await callOpenRouter({
      apiKey,
      endpoint: endpoint || undefined,
      model: model.modelId,
      jsonMode: true,
      temperature: 0.2,
      maxTokens: 400,
      messages: [
        { role: "system", content: DETECT_SYSTEM },
        { role: "user",   content: userBlock },
      ],
    });
    const parsed = extractJson(content);
    if (!parsed || typeof parsed !== "object") return fallback;

    const category = typeof parsed.category === "string"
      ? parsed.category.trim().toLowerCase()
      : "";
    return {
      category: VALID_CATEGORIES.has(category) ? category : fallback.category,
      theme:    typeof parsed.theme === "string" ? parsed.theme.trim().slice(0, 80) : "",
      style:    typeof parsed.style === "string" ? parsed.style.trim().slice(0, 80) : "",
      mood:     Array.isArray(parsed.mood)
        ? parsed.mood.filter((s) => typeof s === "string").map((s) => s.trim()).filter(Boolean).slice(0, 6)
        : [],
      needsExternalBackground: !!parsed.needsExternalBackground,
    };
  } catch {
    return fallback;
  }
}
