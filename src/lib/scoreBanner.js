// src/lib/scoreBanner.js
// Banner quality scorer. Two paths:
//
// 1. Model path — calls the admin-configured default text model (any
//    OpenAI-compatible provider) with a structured rubric and asks for a
//    JSON {score, breakdown, reason}. Used for both the standalone
//    /api/score endpoint and the multi-variant pipeline in /api/banners.
//
// 2. Heuristic path — when no model is configured / API key missing /
//    request fails, we still return a useful score derived from element
//    density, CSS technique coverage, and decorative-layer presence.
//
// We always return a number 0–100. The richness heuristic from
// bannerTemplate.js is the floor — even on model failure, we don't fall
// off a cliff.

import { getModelForStage } from "@/lib/db/stageModels";
import { callOpenRouter, extractJson } from "@/lib/openrouter";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  pickApiKey,
  pickEndpoint,
  templateRichness,
} from "@/lib/bannerTemplate";
import {
  composeScoreImageMessages,
  composeScoreMessages,
  getActivePrompts,
} from "@/lib/prompts";

// All scoring prompts (system + user scaffold for HTML/CSS scoring, plus
// the image-scoring variant) come from src/lib/prompts.js — the same
// module that drives banner generation. Admins edit them at /admin/prompt
// and changes apply to every subsequent score call automatically.

function clampScore(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// Heuristic fallback — uses templateRichness from bannerTemplate.js plus a
// tiny content-relevance bonus when the prompt's main keyword shows up in
// the HTML. Always returns a score in [40, 95].
function heuristicScore({ html = "", css = "", prompt = "" }) {
  const richness = templateRichness({ html, css, fields: [] });
  let bonus = 0;
  const keywords = (prompt || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 5);
  if (keywords.length) {
    const haystack = (html + " " + css).toLowerCase();
    const hits = keywords.filter((k) => haystack.includes(k)).length;
    bonus = Math.min(8, hits * 2);
  }
  return Math.max(40, Math.min(95, richness + bonus));
}

// Score a banner template using the configured text model. Falls back to
// the heuristic when no model / key / endpoint is available, or when the
// model call fails or returns invalid output.
export async function scoreBannerTemplate({
  supabase,
  prompt = "",
  style = "",
  aspect = "",
  html = "",
  css = "",
  modelOverride = null,
}) {
  const heuristic = heuristicScore({ html, css, prompt });

  const model = modelOverride || await getModelForStage(createAdminClient(), "banner_scoring");
  if (!model) {
    return {
      score:    heuristic,
      source:   "heuristic",
      reason:   "No default text model configured — using heuristic score.",
    };
  }

  const apiKey   = pickApiKey(model);
  const endpoint = pickEndpoint(model);

  if (!apiKey) {
    return {
      score:  heuristic,
      source: "heuristic",
      reason: `Model "${model.label}" has no API key — using heuristic score.`,
    };
  }
  if (!endpoint && model.provider !== "openrouter") {
    return {
      score:  heuristic,
      source: "heuristic",
      reason: `Provider "${model.provider}" missing endpoint URL — using heuristic score.`,
    };
  }

  const adminClient = createAdminClient();
  const activePrompts = await getActivePrompts(adminClient).catch(() => null);
  if (!activePrompts) {
    return {
      score:  heuristic,
      source: "heuristic",
      reason: "Could not load scoring prompts — using heuristic score.",
    };
  }

  try {
    const messages = composeScoreMessages({
      prompts: activePrompts,
      brief:   prompt,
      style,
      aspect,
      html,
      css,
    });
    const { content } = await callOpenRouter({
      apiKey,
      endpoint:    endpoint || undefined,
      model:       model.modelId,
      jsonMode:    true,
      // Low temperature for stable, repeatable scoring.
      temperature: model.config?.scoringTemperature ?? 0.2,
      maxTokens:   model.config?.scoringMaxTokens   ?? 600,
      messages,
    });

    const parsed = extractJson(content);
    const score  = clampScore(parsed?.score);
    if (score == null) {
      return {
        score:    heuristic,
        source:   "heuristic",
        reason:   "Scoring model returned invalid JSON — using heuristic score.",
      };
    }
    return {
      score,
      source:    model.label,
      modelId:   model.modelId,
      provider:  model.provider,
      breakdown: parsed?.breakdown || null,
      reason:    typeof parsed?.reason === "string" ? parsed.reason : null,
    };
  } catch (e) {
    return {
      score:  heuristic,
      source: "heuristic",
      reason: `Scoring model failed (${e?.message || "unknown error"}) — using heuristic score.`,
    };
  }
}

// Score a generated image (URL). Uses a vision-capable text model when
// available; falls back to a neutral mid-range score otherwise. The /api/score
// endpoint accepts both shapes — image or html — and dispatches accordingly.
export async function scoreBannerImage({ supabase, prompt = "", imageUrl, modelOverride = null }) {
  if (!imageUrl) {
    return { score: 0, source: "heuristic", reason: "imageUrl is required" };
  }

  const model = modelOverride || await getModelForStage(createAdminClient(), "banner_scoring");
  const apiKey = model ? pickApiKey(model) : null;
  const endpoint = model ? pickEndpoint(model) : null;

  if (!model || !apiKey || (!endpoint && model.provider !== "openrouter")) {
    // No vision model wired up — return a neutral 75. Caller can pick
    // top-scoring even when nothing is configured.
    return {
      score:  75,
      source: "heuristic",
      reason: "No vision model configured — neutral score returned.",
    };
  }

  const adminClient = createAdminClient();
  const activePrompts = await getActivePrompts(adminClient).catch(() => null);
  if (!activePrompts) {
    return { score: 75, source: "heuristic", reason: "Could not load scoring prompts — neutral score returned." };
  }

  try {
    const messages = composeScoreImageMessages({
      prompts: activePrompts,
      brief:   prompt,
      imageUrl,
    });
    const { content } = await callOpenRouter({
      apiKey,
      endpoint:    endpoint || undefined,
      model:       model.modelId,
      jsonMode:    true,
      temperature: 0.2,
      maxTokens:   400,
      messages,
    });
    const parsed = extractJson(content);
    const score  = clampScore(parsed?.score);
    if (score == null) {
      return { score: 75, source: "heuristic", reason: "Vision model returned invalid JSON." };
    }
    return {
      score,
      source:    model.label,
      modelId:   model.modelId,
      provider:  model.provider,
      breakdown: parsed?.breakdown || null,
      reason:    typeof parsed?.reason === "string" ? parsed.reason : null,
    };
  } catch (e) {
    return {
      score:  75,
      source: "heuristic",
      reason: `Vision model failed (${e?.message || "unknown error"}) — neutral score returned.`,
    };
  }
}
