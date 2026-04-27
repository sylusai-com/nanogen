// src/lib/bannerTemplate.js
// Shared HTML banner template generator — used by /api/banners/html (returns
// the template for the editor) and /api/banners (persists a banner in one shot).
//
// The flow:
//   1. Pull the admin-configured default text model from the `models` table.
//   2. Pull the requested style row from the `banner_styles` table.
//   3. Ask OpenRouter for a strict JSON banner template.
//   4. Validate the response shape; fall back to a built-in template (with the
//      DB style colors applied) if the key is missing, no model is configured,
//      or the model output fails validation.

import { getDefaultTextModel } from "@/lib/db/models";
import { getStyleByName } from "@/lib/db/styles";
import {
  callOpenRouter,
  extractJson,
  isOpenRouterConfigured,
} from "@/lib/openrouter";

const SYSTEM_PROMPT = `You are an expert HTML/CSS banner designer for the Nanogen platform.

Output a SINGLE valid JSON object with this exact shape:

{
  "html": string,                  // banner markup
  "css": string,                   // banner styles
  "alignment": "left" | "center" | "right",
  "fields": [                      // editable fields shown in the editor panel
    { "id": string, "type": "text",   "slot": string,        "label": string, "value": string },
    { "id": string, "type": "color",  "cssVar": string,      "label": string, "value": string },
    { "id": string, "type": "range",  "cssVar": string,      "label": string, "value": number, "min": number, "max": number, "step": number, "unit": string },
    { "id": string, "type": "select", "cssVar": string,      "label": string, "value": string, "options": [{ "value": string, "label": string }] },
    { "id": string, "type": "toggle", "selector": string,    "label": string, "value": boolean }
  ]
}

Rules:
- Root: <div class="banner" data-align="left|center|right">. Wrap content in <div class="banner__inner">.
- Editable text uses [data-slot="<id>"]. The slot value MUST match the field id.
- Editable colors use CSS custom properties — define them in :root inside css.
- Range fields drive numeric CSS values via the cssVar (include unit in the field).
- Toggle fields hide/show an element; selector targets a CSS selector. The editor sets display:none when value is false.
- ALWAYS include these text fields: "eyebrow", "headline", "subhead", "cta".
- ALWAYS include these color fields: "bg" (--bg), "fg" (--fg), "accent" (--accent).
- Optionally include: a "headline_size" range field (--headline-size, px), and a "show_eyebrow" toggle.
- HTML must be self-contained — no external assets, fonts, or scripts.
- Use modern CSS: flexbox, color-mix, custom properties. Font: 'Geist', system-ui, sans-serif.
- Match the user's prompt, style, and aspect ratio in the visual design.

Output ONLY the JSON object. No markdown fences, no prose.`;

const FALLBACK_TEMPLATE = {
  html: `<div class="banner" data-align="left">
  <div class="banner__bg"></div>
  <div class="banner__inner">
    <span class="banner__eyebrow" data-slot="eyebrow">NEW</span>
    <h1 class="banner__headline" data-slot="headline">Headline goes here</h1>
    <p class="banner__subhead" data-slot="subhead">Subhead supporting copy.</p>
    <a class="banner__cta" data-slot="cta">Get started</a>
  </div>
</div>`,
  css: `:root { --bg: #0c0c10; --fg: #ffffff; --muted: rgba(255,255,255,0.65); --accent: #a78bfa; --headline-size: 56px; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: transparent; }
body { font-family: 'Geist', ui-sans-serif, system-ui, sans-serif; }
.banner { position: relative; width: 100%; height: 100%; min-height: 320px; overflow: hidden; border-radius: 14px; background: var(--bg); color: var(--fg); }
.banner__bg { position: absolute; inset: 0; background:
  radial-gradient(60% 80% at 0% 0%, color-mix(in oklab, var(--accent) 35%, transparent) 0%, transparent 60%),
  radial-gradient(40% 60% at 100% 100%, color-mix(in oklab, var(--accent) 20%, transparent) 0%, transparent 60%); }
.banner__inner { position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column; justify-content: center; padding: 8% 7%; gap: 14px; }
.banner[data-align="center"] .banner__inner { align-items: center; text-align: center; }
.banner[data-align="right"] .banner__inner { align-items: flex-end; text-align: right; }
.banner__eyebrow { display: inline-block; font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); border: 1px solid color-mix(in oklab, var(--accent) 40%, transparent); padding: 4px 10px; border-radius: 999px; background: color-mix(in oklab, var(--accent) 12%, transparent); }
.banner__headline { font-size: var(--headline-size); line-height: 1.04; letter-spacing: -0.02em; font-weight: 600; margin: 0; }
.banner__subhead { margin: 0; font-size: clamp(14px, 1.6vw, 18px); color: var(--muted); max-width: 56ch; }
.banner__cta { display: inline-flex; align-items: center; gap: 6px; background: var(--accent); color: var(--bg); padding: 10px 18px; border-radius: 999px; font-size: 14px; font-weight: 600; width: fit-content; }`,
  alignment: "left",
  fields: [
    { id: "eyebrow", type: "text", slot: "eyebrow", label: "Eyebrow", value: "NEW" },
    { id: "headline", type: "text", slot: "headline", label: "Headline", value: "Launch day is here" },
    { id: "subhead", type: "text", slot: "subhead", label: "Subhead", value: "Auto-generated from your prompt — edit any field to fine-tune." },
    { id: "cta", type: "text", slot: "cta", label: "CTA", value: "Get started" },
    { id: "bg", type: "color", cssVar: "--bg", label: "Background", value: "#0c0c10" },
    { id: "fg", type: "color", cssVar: "--fg", label: "Text", value: "#ffffff" },
    { id: "accent", type: "color", cssVar: "--accent", label: "Accent", value: "#a78bfa" },
    { id: "headline_size", type: "range", cssVar: "--headline-size", label: "Headline size", value: 56, min: 24, max: 96, step: 2, unit: "px" },
    { id: "show_eyebrow", type: "toggle", selector: ".banner__eyebrow", label: "Show eyebrow", value: true },
  ],
};

function applyStyleRow(template, styleRow) {
  if (!styleRow) return template;
  const next = JSON.parse(JSON.stringify(template));
  for (const f of next.fields) {
    if (f.type === "color") {
      if (f.id === "bg") f.value = styleRow.bg;
      if (f.id === "fg") f.value = styleRow.fg;
      if (f.id === "accent") f.value = styleRow.accent;
    }
  }
  return next;
}

function validateTemplate(t) {
  if (!t || typeof t !== "object") return null;
  if (typeof t.html !== "string" || typeof t.css !== "string") return null;
  if (!Array.isArray(t.fields) || t.fields.length === 0) return null;
  if (!["left", "center", "right"].includes(t.alignment)) t.alignment = "left";
  const ids = new Set(t.fields.map((f) => f.id));
  for (const required of ["headline", "bg", "fg", "accent"]) {
    if (!ids.has(required)) return null;
  }
  return t;
}

export function deriveTitle(prompt) {
  const t = (prompt || "").trim().split(/\s+/).slice(0, 8).join(" ");
  return t.length > 60 ? t.slice(0, 60) + "…" : t || "Untitled banner";
}

export function bgFromTemplate(template) {
  const f = (template?.fields || []).find((x) => x.id === "bg");
  return f?.value || "#0c0c10";
}

// Generates a banner template — calls OpenRouter when configured, otherwise
// returns the styled fallback. Always returns a valid template.
//
// Returns: { html, css, alignment, fields, generator, modelId?, reason?, styleRow? }
export async function generateBannerTemplate({
  supabase,
  prompt,
  style = "Modern",
  aspect = "16:9",
}) {
  // Pull style row from DB so the colors come from admin-managed catalog.
  const styleRow = await getStyleByName(supabase, style);
  const styled = applyStyleRow(FALLBACK_TEMPLATE, styleRow);

  if (!isOpenRouterConfigured()) {
    return {
      ...styled,
      generator: "fallback",
      reason: "OPENROUTER_API_KEY not configured",
      styleRow,
    };
  }

  const textModel = await getDefaultTextModel(supabase);
  if (!textModel) {
    return {
      ...styled,
      generator: "fallback",
      reason: "No enabled text model in the catalog",
      styleRow,
    };
  }

  try {
    const { content } = await callOpenRouter({
      model: textModel.modelId,
      jsonMode: true,
      temperature: 0.7,
      maxTokens: 4000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Prompt: ${prompt}\nStyle: ${style}\nAspect ratio: ${aspect}\n\nGenerate the banner template JSON.`,
        },
      ],
    });

    const parsed = extractJson(content);
    const valid = validateTemplate(parsed);
    if (!valid) {
      return {
        ...styled,
        generator: "fallback",
        reason: "Model output failed validation",
        styleRow,
      };
    }

    return {
      ...valid,
      generator: textModel.label,
      modelId: textModel.modelId,
      styleRow,
    };
  } catch (e) {
    return {
      ...styled,
      generator: "fallback",
      reason: e?.message || "OpenRouter request failed",
      styleRow,
    };
  }
}
