// src/lib/referenceImage.js
//
// Two distinct image-context extractors used by /api/banners.
//
//   1. extractReferenceImageContext()
//        For the user-uploaded REFERENCE image (inspiration only). The
//        extracted JSON is appended to the banner-generation prompt so
//        the LLM can produce a banner inspired by the reference's
//        subject / palette / mood — WITHOUT embedding the image itself.
//
//   2. extractSubjectImageContext()
//        For the user-uploaded SUBJECT image (must appear IN the banner —
//        e.g. the user's headshot, their product photo, etc). The vision
//        model classifies the subject, reports whether it already has a
//        clean cut-out background, suggests CSS treatments to integrate
//        it cleanly (soft mask, circular crop, blend mode), and lists
//        framing notes the banner generator should respect.
//
// Both extractors call whatever vision-capable text model is configured
// as the default. Both are best-effort: failure returns null and the rest
// of the pipeline continues unaffected.

import { callOpenRouter, extractJson } from "@/lib/openrouter";
import { getDefaultTextModelWithSecrets } from "@/lib/db/models";
import { pickApiKey, pickEndpoint } from "@/lib/bannerTemplate";

const SYSTEM_PROMPT = `You are an expert visual designer. The user uploaded a reference image and wants a marketing banner inspired by it. Look at the image and extract structured design context.

Return ONLY a JSON object matching this exact schema:
{
  "subject":     string,                 // 3-8 words describing the main subject / scene
  "category":    string,                 // one of: food, travel, fashion, tech, business, fitness, nature, lifestyle, art, product, other
  "mood":        string[],               // 2-4 descriptive mood adjectives (e.g. "warm", "minimal", "energetic")
  "palette":     string[],               // 3-6 dominant hex colors that capture the photo's color story
  "composition": string,                 // 1-2 sentences on layout, framing, focal point, lighting
  "subjectsToFeature": string[],         // visible objects/elements the banner could echo (e.g. ["pasta bowl", "wooden table", "fork"])
  "vibe":        string                  // a single sentence pitch describing the overall feel
}

Be concise and specific. Hex colors must be valid 6-digit codes. Do not invent details that are not in the image. Return ONLY the JSON.`;

// Returns extracted context or null when extraction is unavailable / fails.
// Intentionally swallows errors — caller should treat the absence of
// context as "no extra signal", not as a request failure.
export async function extractReferenceImageContext({
  adminClient,
  imageUrl,
}) {
  if (!imageUrl) return null;

  const model = await getDefaultTextModelWithSecrets(adminClient);
  if (!model) return null;

  const apiKey   = pickApiKey(model);
  const endpoint = pickEndpoint(model);
  if (!apiKey) return null;
  if (!endpoint && model.provider !== "openrouter") return null;

  try {
    const { content } = await callOpenRouter({
      apiKey,
      endpoint:    endpoint || undefined,
      model:       model.modelId,
      jsonMode:    true,
      temperature: 0.2,
      maxTokens:   500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this reference image and return ONLY the JSON object." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    const parsed = extractJson(content);
    if (!parsed || typeof parsed !== "object") return null;

    return sanitizeContext(parsed);
  } catch {
    return null;
  }
}

// Trim and coerce the model's response into the shape our prompt builder
// expects. Defensive — we never trust raw vision-model output.
function sanitizeContext(raw) {
  const out = {
    subject:           typeof raw.subject     === "string" ? raw.subject.trim().slice(0, 120) : "",
    category:          typeof raw.category    === "string" ? raw.category.trim().toLowerCase().slice(0, 30) : "",
    mood:              [],
    palette:           [],
    composition:       typeof raw.composition === "string" ? raw.composition.trim().slice(0, 400) : "",
    subjectsToFeature: [],
    vibe:              typeof raw.vibe        === "string" ? raw.vibe.trim().slice(0, 240) : "",
  };

  if (Array.isArray(raw.mood)) {
    out.mood = raw.mood
      .filter((s) => typeof s === "string")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 6);
  }
  if (Array.isArray(raw.palette)) {
    out.palette = raw.palette
      .filter((s) => typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s.trim()))
      .map((s) => s.trim().toLowerCase())
      .slice(0, 8);
  }
  if (Array.isArray(raw.subjectsToFeature)) {
    out.subjectsToFeature = raw.subjectsToFeature
      .filter((s) => typeof s === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  // If literally nothing useful came back, don't return an empty stub —
  // the caller checks for null to decide whether to inject context.
  const hasSignal =
    out.subject || out.composition || out.vibe ||
    out.palette.length || out.mood.length || out.subjectsToFeature.length;
  return hasSignal ? out : null;
}

// Builds a short paragraph the banner-generation prompt can consume.
// Returns null when context is empty/unavailable.
export function formatReferenceContextForPrompt(ctx) {
  if (!ctx) return null;
  const lines = [];
  lines.push("REFERENCE IMAGE CONTEXT (inspiration only — extracted from the user's uploaded reference image. Use it to shape the banner's mood, palette, and motifs. DO NOT embed this image in the output):");
  if (ctx.subject)              lines.push(`- Subject: ${ctx.subject}`);
  if (ctx.category)             lines.push(`- Category: ${ctx.category}`);
  if (ctx.mood?.length)         lines.push(`- Mood: ${ctx.mood.join(", ")}`);
  if (ctx.palette?.length)      lines.push(`- Dominant palette (use as inspiration for bg / fg / accent): ${ctx.palette.join(", ")}`);
  if (ctx.composition)          lines.push(`- Composition: ${ctx.composition}`);
  if (ctx.subjectsToFeature?.length) lines.push(`- Visual motifs the banner could echo with CSS / inline SVG: ${ctx.subjectsToFeature.join(", ")}`);
  if (ctx.vibe)                 lines.push(`- Vibe: ${ctx.vibe}`);
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────
// Subject image — features IN the banner (person, product, etc).
// ─────────────────────────────────────────────────────────────────────────

const SUBJECT_SYSTEM_PROMPT = `You are an expert visual designer. The user uploaded a SUBJECT image — a photo (a person, product, object, etc.) they want to actually appear IN the marketing banner, NOT just inspire it. Look at the image and extract structured placement guidance.

Return ONLY a JSON object matching this exact schema:
{
  "subjectType":          string,                 // one of: "person", "product", "object", "scene", "logo", "other"
  "shortDescription":     string,                 // 4-10 words describing what it is (e.g. "young woman smiling at camera", "white sneaker, side view")
  "framing":              string,                 // one of: "headshot", "half-body", "full-body", "product-on-table", "product-floating", "wide-scene", "tight-crop", "other"
  "hasCleanBackground":   boolean,                // true ONLY if the subject is already cleanly cut out (transparent or near-uniform background)
  "backgroundDescription": string,                // 1-2 short phrases describing the existing background (or "transparent" if cut out)
  "needsBackgroundRemoval": boolean,              // true when the existing background distracts from the subject and would benefit from masking
  "suggestedTreatment":   string,                 // one of: "feather-mask" | "circular-crop" | "soft-vignette" | "blend-multiply" | "blend-screen" | "as-is" — the CSS technique most likely to integrate this subject cleanly without literal pixel-level bg removal
  "placement":            string,                 // one of: "right-portrait", "left-portrait", "center-hero", "bottom-band", "background-fill", "corner-accent" — where the subject sits best in the composition
  "dominantColors":       string[],               // 2-4 hex colors that come from the subject itself (skin / clothing / packaging) so the banner palette can harmonize
  "preserveAspect":       boolean                 // whether the subject must keep its native proportions (true for people / products, false for abstract scenes)
}

Be concise and specific. Hex colors must be valid 6-digit codes. Return ONLY the JSON.`;

export async function extractSubjectImageContext({ adminClient, imageUrl }) {
  if (!imageUrl) return null;

  const model = await getDefaultTextModelWithSecrets(adminClient);
  if (!model) return null;

  const apiKey   = pickApiKey(model);
  const endpoint = pickEndpoint(model);
  if (!apiKey) return null;
  if (!endpoint && model.provider !== "openrouter") return null;

  try {
    const { content } = await callOpenRouter({
      apiKey,
      endpoint:    endpoint || undefined,
      model:       model.modelId,
      jsonMode:    true,
      temperature: 0.2,
      maxTokens:   500,
      messages: [
        { role: "system", content: SUBJECT_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this subject image (the user wants it featured IN the banner) and return ONLY the JSON object." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    const parsed = extractJson(content);
    if (!parsed || typeof parsed !== "object") return null;
    return sanitizeSubjectContext(parsed);
  } catch {
    return null;
  }
}

const VALID_SUBJECT_TYPES = new Set(["person", "product", "object", "scene", "logo", "other"]);
const VALID_FRAMING = new Set([
  "headshot", "half-body", "full-body",
  "product-on-table", "product-floating",
  "wide-scene", "tight-crop", "other",
]);
const VALID_TREATMENT = new Set([
  "feather-mask", "circular-crop", "soft-vignette",
  "blend-multiply", "blend-screen", "as-is",
]);
const VALID_PLACEMENT = new Set([
  "right-portrait", "left-portrait", "center-hero",
  "bottom-band", "background-fill", "corner-accent",
]);

function pickEnum(value, allowed, fallback) {
  if (typeof value !== "string") return fallback;
  const v = value.trim().toLowerCase();
  return allowed.has(v) ? v : fallback;
}

function sanitizeSubjectContext(raw) {
  const out = {
    subjectType:           pickEnum(raw.subjectType, VALID_SUBJECT_TYPES, "other"),
    shortDescription:      typeof raw.shortDescription === "string" ? raw.shortDescription.trim().slice(0, 200) : "",
    framing:               pickEnum(raw.framing, VALID_FRAMING, "other"),
    hasCleanBackground:    !!raw.hasCleanBackground,
    backgroundDescription: typeof raw.backgroundDescription === "string" ? raw.backgroundDescription.trim().slice(0, 160) : "",
    needsBackgroundRemoval: !!raw.needsBackgroundRemoval,
    suggestedTreatment:    pickEnum(raw.suggestedTreatment, VALID_TREATMENT, "feather-mask"),
    placement:             pickEnum(raw.placement, VALID_PLACEMENT, "right-portrait"),
    dominantColors:        [],
    preserveAspect:        raw.preserveAspect === false ? false : true,
  };

  if (Array.isArray(raw.dominantColors)) {
    out.dominantColors = raw.dominantColors
      .filter((s) => typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s.trim()))
      .map((s) => s.trim().toLowerCase())
      .slice(0, 6);
  }

  // Sensible default: people / products almost always benefit from a soft
  // mask when they don't have a clean cut-out background, even if the
  // model forgot to flag it.
  if (
    !out.hasCleanBackground &&
    (out.subjectType === "person" || out.subjectType === "product") &&
    !out.needsBackgroundRemoval
  ) {
    out.needsBackgroundRemoval = true;
  }

  if (
    !out.shortDescription &&
    !out.backgroundDescription &&
    !out.dominantColors.length
  ) {
    return null;
  }
  return out;
}

// CSS technique recipes — the prompt quotes these verbatim so every model
// emits compatible CSS for the requested treatment. Keeping the recipes
// in one place means the banner CSS stays predictable across models.
const TREATMENT_RECIPES = {
  "feather-mask":
    "apply mask-image: radial-gradient(ellipse at center, black 60%, transparent 100%) on the subject layer so the existing background fades to transparent at the edges",
  "circular-crop":
    "wrap the subject in a circular frame using clip-path: circle() or border-radius: 50% so the existing rectangular background is hidden",
  "soft-vignette":
    "stack a radial-gradient overlay (transparent center → banner-colored edges) on top of the subject so the background photo blends into the banner",
  "blend-multiply":
    "set mix-blend-mode: multiply on the subject layer so its background dissolves into darker banner colors",
  "blend-screen":
    "set mix-blend-mode: screen on the subject layer so its background dissolves into lighter banner colors",
  "as-is":
    "keep the subject as a clean photo block; do NOT mask its background — the cut-out is already transparent",
};

export function formatSubjectContextForPrompt(ctx) {
  if (!ctx) return null;
  const lines = [];
  lines.push("SUBJECT IMAGE CONTEXT (this image WILL appear IN the rendered banner — it is provided to you as the bg_image data URI. Treat it as a real photographic asset to integrate visibly):");
  if (ctx.subjectType)         lines.push(`- Subject type: ${ctx.subjectType}`);
  if (ctx.shortDescription)    lines.push(`- What it shows: ${ctx.shortDescription}`);
  if (ctx.framing)             lines.push(`- Framing: ${ctx.framing}`);
  lines.push(`- Background of the photo: ${ctx.backgroundDescription || "unknown"} (already cleanly cut out: ${ctx.hasCleanBackground ? "yes" : "no"})`);
  lines.push(
    ctx.needsBackgroundRemoval
      ? `- The photo's background DISTRACTS from the subject — you MUST integrate it using CSS treatment "${ctx.suggestedTreatment}". Recipe: ${TREATMENT_RECIPES[ctx.suggestedTreatment] || "soft mask the edges"}.`
      : `- The photo's background is acceptable as-is — render the bg_image without aggressive masking, but you may still apply gentle vignettes for depth.`,
  );
  if (ctx.placement)           lines.push(`- Suggested placement: ${ctx.placement} — design the layout so headline / CTAs do not overlap the subject's face or focal area.`);
  if (ctx.dominantColors?.length) lines.push(`- Subject's dominant colors (harmonize bg / fg / accent so they work next to the photo): ${ctx.dominantColors.join(", ")}`);
  lines.push(`- Preserve native aspect: ${ctx.preserveAspect ? "yes — do NOT distort the photo" : "no — cropping is OK"}.`);
  lines.push("HOW TO RENDER THE SUBJECT IN HTML/CSS:");
  lines.push('- The bg_image field value is already set to url("data:…") for you. Do NOT replace it. Reference it via var(--bg-image) on a dedicated layer.');
  lines.push("- Wrap that layer with the chosen treatment so the subject reads cleanly against the banner background. Examples: a portrait subject with a busy background → use feather-mask or circular-crop; a product with a white background → use blend-multiply on a light banner OR blend-screen on a dark banner.");
  lines.push("- Adjust object-position / background-position (via --bg-position) so the subject's focal area (face, label) lands in the banner's positive space, not under the headline.");
  lines.push("- The subject is the HERO. Headline + CTAs must complement it, not cover it. Use the 'placement' hint to decide which side gets the copy.");
  return lines.join("\n");
}
