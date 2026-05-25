// src/lib/bannerGeneration.js
//
// Two LLM helpers the /api/banners pipeline uses to implement the
// orchestration spec without inflating the route handler:
//
//   enhancePrompt          → spec steps 3 + 4 (intelligent prompt
//                            enhancement + subject placement decision).
//                            One LLM call rewrites the brief using the
//                            reference + subject contexts and returns the
//                            placement decision.
//
//   detectCategoryAndStyle → spec step 6 (post-generation classification
//                            of the winning banner — category, theme,
//                            style, mood, needsExternalBackground).
//
// Both are best-effort: they fall back to deterministic shapes when the
// default text model is unconfigured or returns junk, so the route never
// hard-fails on a classification error.
//
// `GenerationSteps` is re-exported from the job queue so UI consumers can
// pull every step constant from one place. The orchestration spec's seven
// steps are mapped 1:1 onto the step IDs in lib/generationQueue.js.

import { callOpenRouter, extractJson } from "@/lib/openrouter";
import { GenerationJobSteps } from "@/lib/generationQueue";
import {
  formatReferenceContextForPrompt,
  formatSubjectContextForPrompt,
} from "@/lib/referenceImage";
import { pickApiKey, pickEndpoint } from "@/lib/bannerTemplate";
import { getModelForStage } from "@/lib/db/stageModels";

export { GenerationJobSteps as GenerationSteps };

// ──────────────────────────────────────────────────────────────────────────
// enhancePrompt — spec steps 3 + 4
// ──────────────────────────────────────────────────────────────────────────

// One LLM call does three things at once so they stay consistent with each
// other: enrich the brief, decide subject placement, decide whether a
// photographic background should be fetched. Splitting these would let
// the answers drift apart (e.g. enriched copy promising a sunset photo
// while the placement step thinks no bg is needed).
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

export async function enhancePrompt({
  adminClient,
  userPrompt,
  aspectRatio,
  style,
  referenceContext,
  subjectContext,
  modelOverride = null,
}) {
  const fallback = {
    brief: userPrompt,
    reserveSpace: !!subjectContext,
    placement: subjectContext?.placement || "none",
    needsBackground: !referenceContext && !!subjectContext,
    reasoning: "fallback heuristic — LLM unavailable",
  };

  const model = modelOverride || await getModelForStage(adminClient, "prompt_enhancement").catch(() => null);
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

// ──────────────────────────────────────────────────────────────────────────
// detectCategoryAndStyle — spec step 6
// ──────────────────────────────────────────────────────────────────────────

// Reads brief + the winner's HTML/CSS to produce metadata used by two
// downstream stages:
//   • the bg-fetch step picks providers / queries by category
//   • the saved banner row carries category + theme + style + mood as
//     dashboard / regenerate filters
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

export async function detectCategoryAndStyle({
  adminClient,
  brief,
  referenceContext,
  subjectContext,
  sampleBanner,
  modelOverride = null,
}) {
  const fallback = {
    category: referenceContext?.category || "other",
    theme: "",
    style: "",
    mood: Array.isArray(referenceContext?.mood) ? referenceContext.mood.slice(0, 4) : [],
    needsExternalBackground: false,
  };

  const model = modelOverride || await getModelForStage(adminClient, "category_detection").catch(() => null);
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
