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

import { getDefaultTextModel } from "@/lib/db/models";
import { callOpenRouter, extractJson } from "@/lib/openrouter";
import {
  pickApiKey,
  pickEndpoint,
  templateRichness,
} from "@/lib/bannerTemplate";

const SYSTEM_PROMPT = `You are a senior brand designer and design critic. You evaluate marketing banners against the bar set by Apple, Stripe, Linear, and Vercel.

You will receive:
  - a brief (what the banner is for)
  - the banner's HTML
  - the banner's CSS

Score the banner on a 0–100 scale where:
  100 — could ship as a flagship hero on the homepage of a top-tier product company.
   90 — clearly modern, distinctive, multiple components, on-brief.
   80 — solid, on-brief, would pass review with minor tweaks.
   70 — generic but functional. Looks like a placeholder.
   60 — basic / boring. Headline + subhead + button on a flat gradient.
   50 or below — broken, ugly, or off-brief.

Rubric (each 0–20):
  RELEVANCE       — does it match the brief subject and tone?
  COMPOSITION     — is the layout intentional, balanced, with visual hierarchy?
  RICHNESS        — element density, decorative layers, multiple components?
  POLISH          — typography, spacing, color harmony, modern CSS?
  DISTINCTIVENESS — does it stand out, or is it the generic "centered headline + button" stack?

OUTPUT — return ONLY a JSON object exactly matching:

{
  "score": number,
  "breakdown": {
    "relevance": number,
    "composition": number,
    "richness": number,
    "polish": number,
    "distinctiveness": number
  },
  "reason": string
}

Be honest. Generic banners get 60–70, not 90.`;

function buildUserMessage({ prompt = "", style = "", aspect = "", html = "", css = "" }) {
  return `BRIEF: ${prompt || "(none provided)"}
STYLE: ${style || "—"}
ASPECT: ${aspect || "—"}

HTML:
${html.slice(0, 12000)}

CSS:
${css.slice(0, 12000)}

Return ONLY the JSON object — no prose, no markdown.`;
}

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
}) {
  const heuristic = heuristicScore({ html, css, prompt });

  const model = await getDefaultTextModel(supabase);
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

  try {
    const { content } = await callOpenRouter({
      apiKey,
      endpoint:    endpoint || undefined,
      model:       model.modelId,
      jsonMode:    true,
      // Low temperature for stable, repeatable scoring.
      temperature: model.config?.scoringTemperature ?? 0.2,
      maxTokens:   model.config?.scoringMaxTokens   ?? 600,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: buildUserMessage({ prompt, style, aspect, html, css }) },
      ],
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
export async function scoreBannerImage({ supabase, prompt = "", imageUrl }) {
  if (!imageUrl) {
    return { score: 0, source: "heuristic", reason: "imageUrl is required" };
  }

  const model = await getDefaultTextModel(supabase);
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

  try {
    const { content } = await callOpenRouter({
      apiKey,
      endpoint:    endpoint || undefined,
      model:       model.modelId,
      jsonMode:    true,
      temperature: 0.2,
      maxTokens:   400,
      messages: [
        { role: "system", content: SYSTEM_PROMPT.replace("HTML", "image").replace("CSS", "rendered output") },
        {
          role: "user",
          content: [
            { type: "text", text: `BRIEF: ${prompt || "(none provided)"}\nReturn ONLY the JSON object — score, breakdown, reason.` },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
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
