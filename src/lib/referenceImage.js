// src/lib/referenceImage.js
//
// Extracts design context from a user-uploaded reference image. Used by
// /api/banners when the user attaches an image at /dashboard/create — the
// extracted JSON is appended to the banner-generation prompt so the LLM
// can produce a banner inspired by the reference (subject, palette,
// composition, mood) without literally embedding the image.
//
// The extractor calls whatever vision-capable text model is configured as
// the default. It's best-effort: failure returns null and the rest of the
// pipeline continues unaffected.

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
  lines.push("REFERENCE IMAGE CONTEXT (extracted from the user's uploaded reference — let it inspire the banner without embedding the image itself):");
  if (ctx.subject)              lines.push(`- Subject: ${ctx.subject}`);
  if (ctx.category)             lines.push(`- Category: ${ctx.category}`);
  if (ctx.mood?.length)         lines.push(`- Mood: ${ctx.mood.join(", ")}`);
  if (ctx.palette?.length)      lines.push(`- Dominant palette (use as inspiration for bg / fg / accent): ${ctx.palette.join(", ")}`);
  if (ctx.composition)          lines.push(`- Composition: ${ctx.composition}`);
  if (ctx.subjectsToFeature?.length) lines.push(`- Visual motifs the banner could echo with CSS / inline SVG: ${ctx.subjectsToFeature.join(", ")}`);
  if (ctx.vibe)                 lines.push(`- Vibe: ${ctx.vibe}`);
  return lines.join("\n");
}
