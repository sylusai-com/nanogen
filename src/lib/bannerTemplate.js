// src/lib/bannerTemplate.js
// Shared HTML banner template generator — used by /api/banners (persists a
// banner in one shot) and /api/banners/html (returns the template for the
// editor).
//
// Backgrounds: the banner is HTML + CSS only. NO external image URLs.
// Backgrounds are produced by the model using CSS gradients, color-mix,
// and inline SVG (data: URIs). External hosts (Unsplash, Pexels, Imgur,
// etc.) are stripped from the output to ensure the banner renders even
// when the model hallucinates a stock photo URL.

import { getDefaultTextModelWithSecrets } from "@/lib/db/models";
import { getStyleByName } from "@/lib/db/styles";
import { callOpenRouter, extractJson } from "@/lib/openrouter";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  composeBannerMessages,
  getActivePrompts,
} from "@/lib/prompts";
import {
  accentFor,
  contrastRatio,
  readableForegroundFor,
} from "@/lib/color";

// All banner-generation prompts (system, per-aspect briefing, user-message
// scaffold) live in src/lib/prompts.js. This file used to hard-code its
// own copies, which silently drifted from the admin-editable versions in
// app_settings whenever one side moved. Now there is a single source of
// truth: composeBannerMessages() pulls from the active prompts loaded in
// generateBannerTemplate(), and the admin UI edits the same defaults.

// ─────────────────────────────────────────────────────────────────────────
// FALLBACK — used when no model is configured / call fails. CSS-only:
// gradients, SVG noise, decorative orbs. No external image URLs.
// ─────────────────────────────────────────────────────────────────────────
const FALLBACK_TEMPLATE = {
  html: `<div class="banner" data-align="left" data-aspect="16:9">
  <div class="banner__bg">
    <div class="banner__bg-image"></div>
    <div class="banner__mesh"></div>
    <div class="banner__grid"></div>
    <div class="banner__noise"></div>
    <div class="banner__orb banner__orb--a"></div>
    <div class="banner__orb banner__orb--b"></div>
    <div class="banner__orb banner__orb--c"></div>
  </div>
  <div class="banner__inner">
    <div class="banner__top">
      <span class="banner__eyebrow" data-slot="eyebrow"><span class="banner__dot"></span>NEW · v2.0</span>
      <span class="banner__version" data-slot="version_tag">2026</span>
    </div>
    <h1 class="banner__headline" data-slot="headline">Your headline goes here</h1>
    <p class="banner__subhead" data-slot="subhead">Auto-generated from your prompt — edit any field to fine-tune the design, copy, and color palette.</p>
    <div class="banner__features">
      <div class="banner__feature"><span class="banner__feat-num">01</span><span data-slot="feature1">Modern composition</span></div>
      <div class="banner__feature"><span class="banner__feat-num">02</span><span data-slot="feature2">Editable fields</span></div>
      <div class="banner__feature"><span class="banner__feat-num">03</span><span data-slot="feature3">Live preview</span></div>
    </div>
    <div class="banner__ctas">
      <a class="banner__cta banner__cta--primary" data-slot="cta_primary">Get started <span aria-hidden="true">→</span></a>
      <a class="banner__cta banner__cta--secondary" data-slot="cta_secondary">Learn more</a>
    </div>
    <div class="banner__trust"><span class="banner__avatars"><span></span><span></span><span></span></span><span data-slot="trust_line">Trusted by 10,000+ teams worldwide</span></div>
  </div>
  <div class="banner__corner banner__corner--tl"></div>
  <div class="banner__corner banner__corner--br"></div>
</div>`,
  css: `:root {
  --bg: #0a0a0f;
  --fg: #ffffff;
  --muted: rgba(255,255,255,0.65);
  --accent: #a78bfa;
  --accent2: #22d3ee;
  --accent3: #f472b6;
  --headline-size: 64px;
  --bg-image: none;
  --bg-brightness: 0.7;
  --bg-blur: 0px;
  --bg-overlay: 0.45;
  --bg-zoom: 110%;
  --bg-position: center center;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: transparent; }
body { font-family: 'Geist', ui-sans-serif, system-ui, sans-serif; }

.banner {
  position: relative; width: 100%; height: 100%; min-height: 320px;
  overflow: hidden; border-radius: 16px;
  background: var(--bg); color: var(--fg); isolation: isolate;
}
.banner__bg { position: absolute; inset: 0; z-index: 0; }
/* Optional bg image layer — the model may emit a context-aware inline SVG
   data URI in the bg_image field, OR the user may upload a subject image
   from the dashboard. When --bg-image is the literal "none" we render
   nothing and the CSS-only background takes over. */
.banner__bg-image {
  position: absolute; inset: 0; z-index: 0;
  background-image: var(--bg-image);
  background-size: var(--bg-zoom, 110%);
  background-position: var(--bg-position, center center);
  background-repeat: no-repeat;
  filter: brightness(var(--bg-brightness, 0.7)) blur(var(--bg-blur, 0px));
}
.banner__bg-image::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent, rgba(0,0,0,calc(var(--bg-overlay, 0.45) * 0.9)), rgba(0,0,0,var(--bg-overlay, 0.45)));
  pointer-events: none;
}
.banner__mesh {
  position: absolute; inset: 0;
  background:
    radial-gradient(60% 80% at 0% 0%, color-mix(in oklab, var(--accent) 35%, transparent) 0%, transparent 60%),
    radial-gradient(50% 70% at 100% 100%, color-mix(in oklab, var(--accent2) 28%, transparent) 0%, transparent 60%),
    radial-gradient(40% 60% at 80% 0%, color-mix(in oklab, var(--accent3) 22%, transparent) 0%, transparent 60%),
    linear-gradient(135deg, color-mix(in oklab, var(--bg) 92%, var(--accent) 8%), var(--bg) 70%);
}
.banner__grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(color-mix(in oklab, var(--fg) 7%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in oklab, var(--fg) 7%, transparent) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(70% 50% at 50% 50%, black, transparent);
  opacity: 0.7;
}
.banner__noise {
  position: absolute; inset: 0; pointer-events: none; opacity: 0.18;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.7 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/></svg>");
}
.banner__orb { position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.55; }
.banner__orb--a { width: 50%; height: 70%; left: -10%; top: -20%; background: radial-gradient(circle, var(--accent), transparent 70%); }
.banner__orb--b { width: 40%; height: 60%; right: -10%; bottom: -20%; background: radial-gradient(circle, var(--accent2), transparent 70%); }
.banner__orb--c { width: 28%; height: 40%; right: 30%; top: 10%; background: radial-gradient(circle, var(--accent3), transparent 70%); opacity: 0.4; }

.banner__corner { position: absolute; width: 28px; height: 28px; opacity: 0.45; pointer-events: none; }
.banner__corner--tl { top: 16px; left: 16px; border-top: 1px solid var(--fg); border-left: 1px solid var(--fg); }
.banner__corner--br { bottom: 16px; right: 16px; border-bottom: 1px solid var(--fg); border-right: 1px solid var(--fg); }

.banner__inner {
  position: relative; z-index: 1; height: 100%;
  display: flex; flex-direction: column; justify-content: center;
  padding: clamp(24px, 6%, 64px); gap: 14px; max-width: 80%;
}
/* Square / portrait / story canvases must use the full width — a 20% empty
   right-hand column reads as a broken layout on tall aspects. */
.banner[data-aspect="1:1"]  .banner__inner,
.banner[data-aspect="4:5"]  .banner__inner,
.banner[data-aspect="9:16"] .banner__inner { max-width: 100%; gap: 18px; }
.banner[data-aspect="9:16"] .banner__inner { justify-content: space-between; padding: clamp(28px, 8%, 80px) clamp(20px, 6%, 56px); }
.banner[data-align="center"] .banner__inner { align-items: center; text-align: center; max-width: 100%; margin: 0 auto; }
.banner[data-align="right"] .banner__inner { align-items: flex-end; text-align: right; margin-left: auto; }
/* Headline sizing scales by the short edge so portrait / story banners get
   a proportionally larger title than a 16:9 hero would. */
.banner[data-aspect="1:1"]  .banner__headline { font-size: clamp(36px, 8vw, 96px); }
.banner[data-aspect="4:5"]  .banner__headline { font-size: clamp(36px, 8vw, 104px); }
.banner[data-aspect="9:16"] .banner__headline { font-size: clamp(40px, 10vw, 120px); line-height: 1.02; }

.banner__top { display: flex; align-items: center; gap: 10px; }
.banner__eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--accent);
  border: 1px solid color-mix(in oklab, var(--accent) 40%, transparent);
  padding: 5px 12px; border-radius: 999px;
  background: color-mix(in oklab, var(--accent) 12%, transparent);
  backdrop-filter: blur(8px);
}
.banner__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent); }
.banner__version {
  font-size: 10px; font-family: ui-monospace, monospace; color: var(--muted);
  border: 1px solid color-mix(in oklab, var(--fg) 16%, transparent);
  padding: 3px 8px; border-radius: 6px;
}

.banner__headline {
  font-size: clamp(32px, var(--headline-size, 64px), 96px);
  line-height: 1.04; letter-spacing: -0.025em; font-weight: 700; margin: 0;
  background: linear-gradient(135deg, var(--fg), color-mix(in oklab, var(--fg) 70%, var(--accent)) 60%, color-mix(in oklab, var(--fg) 50%, var(--accent3)));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.banner__subhead { margin: 0; font-size: clamp(14px, 1.4vw, 18px); color: var(--muted); max-width: 56ch; line-height: 1.5; }

.banner__features {
  display: flex; gap: 18px; flex-wrap: wrap; margin-top: 4px;
  font-size: 12px; color: color-mix(in oklab, var(--fg) 78%, transparent);
}
.banner__feature { display: inline-flex; align-items: center; gap: 8px; }
.banner__feat-num {
  font-family: ui-monospace, monospace; font-size: 10px;
  background: color-mix(in oklab, var(--accent) 18%, transparent);
  color: var(--accent);
  padding: 3px 6px; border-radius: 4px;
}

.banner__ctas { display: inline-flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.banner__cta {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 12px 22px; border-radius: 999px;
  font-size: 14px; font-weight: 700; cursor: pointer; text-decoration: none;
}
.banner__cta--primary {
  background: linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 60%, var(--accent2)));
  color: var(--bg);
  box-shadow: 0 8px 32px -8px color-mix(in oklab, var(--accent) 60%, transparent);
}
.banner__cta--secondary {
  background: color-mix(in oklab, var(--fg) 8%, transparent);
  color: var(--fg);
  border: 1px solid color-mix(in oklab, var(--fg) 18%, transparent);
  backdrop-filter: blur(8px);
}

.banner__trust { display: inline-flex; align-items: center; gap: 10px; margin-top: 6px; font-size: 11px; color: var(--muted); }
.banner__avatars { display: inline-flex; }
.banner__avatars span {
  width: 18px; height: 18px; border-radius: 50%; display: inline-block;
  border: 2px solid var(--bg); margin-left: -6px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
}
.banner__avatars span:first-child { margin-left: 0; }
.banner__avatars span:nth-child(2) { background: linear-gradient(135deg, var(--accent2), var(--accent3)); }
.banner__avatars span:nth-child(3) { background: linear-gradient(135deg, var(--accent3), var(--accent)); }`,
  alignment: "left",
  fields: [
    { id: "eyebrow",        type: "text",   slot: "eyebrow",        label: "Eyebrow",          value: "NEW · v2.0" },
    { id: "version_tag",    type: "text",   slot: "version_tag",    label: "Version tag",      value: "2026" },
    { id: "headline",       type: "text",   slot: "headline",       label: "Headline",         value: "Launch day is here" },
    { id: "subhead",        type: "text",   slot: "subhead",        label: "Subhead",          value: "Auto-generated from your prompt — edit any field to fine-tune the design, copy, and color palette." },
    { id: "feature1",       type: "text",   slot: "feature1",       label: "Feature 1",        value: "Modern composition" },
    { id: "feature2",       type: "text",   slot: "feature2",       label: "Feature 2",        value: "Editable fields" },
    { id: "feature3",       type: "text",   slot: "feature3",       label: "Feature 3",        value: "Live preview" },
    { id: "cta_primary",    type: "text",   slot: "cta_primary",    label: "Primary CTA",      value: "Get started →" },
    { id: "cta_secondary",  type: "text",   slot: "cta_secondary",  label: "Secondary CTA",    value: "Learn more" },
    { id: "trust_line",     type: "text",   slot: "trust_line",     label: "Trust line",       value: "Trusted by 10,000+ teams worldwide" },
    { id: "bg",             type: "color",  cssVar: "--bg",         label: "Background",       value: "#0a0a0f" },
    { id: "fg",             type: "color",  cssVar: "--fg",         label: "Text",             value: "#ffffff" },
    { id: "accent",         type: "color",  cssVar: "--accent",     label: "Accent",           value: "#a78bfa" },
    { id: "accent2",        type: "color",  cssVar: "--accent2",    label: "Accent 2",         value: "#22d3ee" },
    { id: "accent3",        type: "color",  cssVar: "--accent3",    label: "Accent 3",         value: "#f472b6" },
    { id: "headline_size",  type: "range",  cssVar: "--headline-size", label: "Headline size", value: 64, min: 32, max: 120, step: 2, unit: "px" },
    { id: "bg_image",       type: "image",  cssVar: "--bg-image",   slot: "bg_image", label: "Background image", value: "" },
    { id: "bg_brightness",  type: "range",  cssVar: "--bg-brightness", label: "Image brightness", value: 0.7, min: 0.2, max: 1.2, step: 0.05, unit: "" },
    { id: "bg_blur",        type: "range",  cssVar: "--bg-blur",       label: "Image blur",       value: 0,   min: 0,   max: 20,  step: 1,    unit: "px" },
    { id: "bg_overlay",     type: "range",  cssVar: "--bg-overlay",    label: "Image overlay",    value: 0.45, min: 0,  max: 0.9, step: 0.05, unit: "" },
    { id: "bg_zoom",        type: "range",  cssVar: "--bg-zoom",       label: "Image zoom",       value: 110, min: 100, max: 200, step: 5,    unit: "%" },
    { id: "bg_position",    type: "select", cssVar: "--bg-position",   label: "Image position",   value: "center center",
      options: [
        { value: "center center", label: "Center" },
        { value: "center top",    label: "Top" },
        { value: "center bottom", label: "Bottom" },
        { value: "left center",   label: "Left" },
        { value: "right center",  label: "Right" },
      ] },
    { id: "show_eyebrow",   type: "toggle", selector: ".banner__eyebrow", label: "Show eyebrow", value: true },
    { id: "show_features",  type: "toggle", selector: ".banner__features", label: "Show features", value: true },
    { id: "show_trust",     type: "toggle", selector: ".banner__trust",    label: "Show trust line", value: true },
    { id: "show_decor",     type: "toggle", selector: ".banner__bg",       label: "Show decoration", value: true },
  ],
};

function applyStyleRow(template, styleRow) {
  if (!styleRow) return template;
  const next = JSON.parse(JSON.stringify(template));
  for (const f of next.fields) {
    if (f.type === "color") {
      if (f.id === "bg")     f.value = styleRow.bg;
      if (f.id === "fg")     f.value = styleRow.fg;
      if (f.id === "accent") f.value = styleRow.accent;
    }
  }
  return enforceContrast(next);
}

// Stamp the chosen aspect onto the fallback markup so the [data-aspect="…"]
// CSS rules in the template fire and the fallback adapts (full-width inner,
// rebalanced padding, rescaled headline) instead of always rendering a
// landscape layout squashed into a tall canvas.
function applyAspectToTemplate(template, aspect) {
  if (!template?.html || !aspect) return template;
  const next = { ...template };
  next.html = next.html.replace(
    /(<div\s+class="banner"[^>]*?)\sdata-aspect="[^"]*"/i,
    `$1`,
  );
  next.html = next.html.replace(
    /(<div\s+class="banner"[^>]*?)>/i,
    `$1 data-aspect="${aspect}">`,
  );
  return next;
}

// Strip any external (http/https) image URLs the model emitted in defiance
// of the system prompt. Inline SVG data: URIs are kept — those are
// CSS-native and produced by the model itself; user-uploaded reference
// images (data: URIs injected by the API route) also flow through unchanged.
const EXTERNAL_URL_IN_CSS_RE = /url\(\s*["']?https?:\/\/[^)"']+["']?\s*\)/gi;
const EXTERNAL_URL_RE        = /^https?:\/\//i;

function stripExternalImageUrls(template) {
  if (!template) return template;
  const next = { ...template };

  if (typeof next.html === "string") {
    next.html = next.html
      .replace(EXTERNAL_URL_IN_CSS_RE, 'none')
      .replace(/<img\b[^>]*src\s*=\s*["']https?:\/\/[^"']+["'][^>]*\/?>(\s*<\/img>)?/gi, "");
  }
  if (typeof next.css === "string") {
    next.css = next.css.replace(EXTERNAL_URL_IN_CSS_RE, 'none');
  }
  if (Array.isArray(next.fields)) {
    next.fields = next.fields
      .map((f) => {
        if (f?.type !== "image") return f;
        const raw = String(f.value || "");
        const m   = raw.match(/^url\(["']?(.+?)["']?\)$/i);
        const inner = (m ? m[1] : raw).trim();
        if (EXTERNAL_URL_RE.test(inner)) {
          return { ...f, value: "" };
        }
        return f;
      });
  }
  return next;
}

function enforceStaticBanner(template) {
  if (!template) return template;
  const next = { ...template };
  let css = String(next.css || "");

  // Remove all explicit keyframes/animations/transitions so exported and previewed banners stay static.
  css = css.replace(/@keyframes\s+[^{]+\{[\s\S]*?\}\s*\}/gi, "");
  css = css.replace(/animation\s*:[^;]+;?/gi, "animation: none !important;");
  css = css.replace(/transition\s*:[^;]+;?/gi, "transition: none !important;");

  css += `

* {
  animation: none !important;
  transition: none !important;
}
`;

  next.css = css;
  return next;
}

function validateTemplate(t) {
  if (!t || typeof t !== "object") return null;
  if (typeof t.html !== "string" || typeof t.css !== "string") return null;
  if (!Array.isArray(t.fields) || t.fields.length === 0) return null;
  if (!["left", "center", "right"].includes(t.alignment)) t.alignment = "left";

  // The model is told not to emit image fields, but we still accept them
  // here so the editor can surface user-uploaded reference images (data:
  // URIs) that get injected into the bg_image field after generation.
  // External http(s) values were already stripped upstream.
  const VALID_TYPES = new Set(["text", "color", "range", "select", "toggle", "image"]);
  t.fields = t.fields.filter(
    (f) => f && typeof f.id === "string" && VALID_TYPES.has(f.type),
  );

  const ids = new Set(t.fields.map((f) => f.id));
  for (const required of ["headline", "bg", "fg", "accent"]) {
    if (!ids.has(required)) return null;
  }

  const tagCount = (t.html.match(/<[a-zA-Z][^>/]*>/g) || []).length;
  if (tagCount < 3) return null;
  if (t.css.length < 100) return null;

  return t;
}

// Guarantee a bg_image field exists (with value === "" when absent) so
// downstream consumers (editor, server inserts, exports) can rely on the
// field shape regardless of which model produced the template. We append
// the field plus the visual-tuning companions only when missing — never
// overwrite values the model emitted.
function ensureBgImageField(template) {
  if (!template?.fields) return template;
  const fields = [...template.fields];
  const has = (id) => fields.some((f) => f?.id === id);

  if (!has("bg_image")) {
    fields.push({
      id: "bg_image", type: "image", cssVar: "--bg-image", slot: "bg_image",
      label: "Background image", value: "",
    });
  }
  if (!has("bg_brightness")) {
    fields.push({
      id: "bg_brightness", type: "range", cssVar: "--bg-brightness",
      label: "Image brightness", value: 0.7, min: 0.2, max: 1.2, step: 0.05, unit: "",
    });
  }
  if (!has("bg_blur")) {
    fields.push({
      id: "bg_blur", type: "range", cssVar: "--bg-blur",
      label: "Image blur", value: 0, min: 0, max: 20, step: 1, unit: "px",
    });
  }
  if (!has("bg_overlay")) {
    fields.push({
      id: "bg_overlay", type: "range", cssVar: "--bg-overlay",
      label: "Image overlay", value: 0.45, min: 0, max: 0.9, step: 0.05, unit: "",
    });
  }
  if (!has("bg_zoom")) {
    fields.push({
      id: "bg_zoom", type: "range", cssVar: "--bg-zoom",
      label: "Image zoom", value: 110, min: 100, max: 200, step: 5, unit: "%",
    });
  }
  if (!has("bg_position")) {
    fields.push({
      id: "bg_position", type: "select", cssVar: "--bg-position",
      label: "Image position", value: "center center",
      options: [
        { value: "center center", label: "Center" },
        { value: "center top",    label: "Top" },
        { value: "center bottom", label: "Bottom" },
        { value: "left center",   label: "Left" },
        { value: "right center",  label: "Right" },
      ],
    });
  }
  return { ...template, fields };
}

// Apply the user-supplied subject image (a data: URI uploaded from the
// dashboard) as the bg_image value, overriding whatever the model emitted.
// We always wrap with url(...) so the CSS variable resolves cleanly, and
// degrade gracefully when no subject image is provided.
function applySubjectImage(template, subjectImage) {
  if (!template?.fields) return template;
  if (!subjectImage || typeof subjectImage !== "string") return template;
  const trimmed = subjectImage.trim();
  if (!trimmed.startsWith("data:image/") && !/^https?:\/\//i.test(trimmed)) {
    return template;
  }
  const wrapped = `url("${trimmed}")`;
  const next = { ...template, fields: template.fields.map((f) => ({ ...f })) };
  let found = false;
  for (const f of next.fields) {
    if (f.id === "bg_image") {
      f.value = wrapped;
      found = true;
    }
  }
  if (!found) {
    next.fields.push({
      id: "bg_image", type: "image", cssVar: "--bg-image", slot: "bg_image",
      label: "Background image", value: wrapped,
    });
  }
  return next;
}

// Walks the fields[] for the bg / fg / accent triplet, swaps or coerces
// values so contrast is readable and saves the user from invisible text.
function enforceContrast(template) {
  if (!template?.fields) return template;
  const next   = { ...template, fields: template.fields.map((f) => ({ ...f })) };
  const findColor = (id) => next.fields.find((f) => f.id === id && f.type === "color");

  const bgF      = findColor("bg");
  const fgF      = findColor("fg");
  const accentF  = findColor("accent");
  const accent2F = findColor("accent2");
  const accent3F = findColor("accent3");

  if (!bgF || !fgF) return next;

  if (contrastRatio(bgF.value, fgF.value) < 4.5) {
    fgF.value = readableForegroundFor(bgF.value);
  }

  if (accentF) accentF.value = accentFor(bgF.value, accentF.value);
  if (accent2F) accent2F.value = accentFor(bgF.value, accent2F.value);
  if (accent3F) accent3F.value = accentFor(bgF.value, accent3F.value);

  const headlineColorRe = /\.banner__headline\s*{[^}]*color\s*:\s*([^;}]+)/i;
  const m = next.css.match(headlineColorRe);
  if (m) {
    const lit = m[1].trim();
    if (contrastRatio(bgF.value, lit) < 3.0) {
      next.css = next.css.replace(headlineColorRe, (full) =>
        full.replace(/color\s*:\s*[^;}]+/, "color: var(--fg)"),
      );
    }
  }

  return next;
}

export function deriveTitle(prompt) {
  const t = (prompt || "").trim().split(/\s+/).slice(0, 8).join(" ");
  return t.length > 60 ? t.slice(0, 60) + "…" : t || "Untitled banner";
}

export function bgFromTemplate(template) {
  const f = (template?.fields || []).find((x) => x.id === "bg");
  return f?.value || "#0c0c10";
}

export function pickApiKey(model) {
  const c = model?.config || {};
  return c.apiKey || c.api_key || c.openrouterApiKey || c.openrouter_api_key || null;
}
export function pickEndpoint(model) {
  const c = model?.config || {};
  return c.endpoint || c.baseUrl || c.url || null;
}

// Heuristic richness score — used as a quick local check on a generated
// template (cheap signal even before a vision/text model rates it).
export function templateRichness(template) {
  if (!template?.html) return 0;
  const html = template.html;
  const css  = template.css || "";

  let score = 50;

  const elementCount = (html.match(/<\w+/g) || []).length;
  if (elementCount >= 8)  score += 4;
  if (elementCount >= 14) score += 6;
  if (elementCount >= 22) score += 6;

  const techniques = [
    /linear-gradient\(/i, /radial-gradient\(/i, /conic-gradient\(/i,
    /color-mix\(/i, /backdrop-filter:/i, /mix-blend-mode:/i,
    /mask(-image)?:/i, /clip-path:/i, /@keyframes/i, /animation:/i,
    /filter:\s*(?:blur|drop-shadow|hue-rotate|brightness)/i,
    /background-clip:\s*text/i, /transform:/i, /<svg/i,
    /text-shadow:/i, /box-shadow:/i,
  ];
  const techniqueHits = techniques.filter((re) => re.test(css) || re.test(html)).length;
  score += Math.min(20, techniqueHits * 2);

  const fieldCount = template.fields?.length || 0;
  if (fieldCount >= 8)  score += 3;
  if (fieldCount >= 14) score += 4;

  const decorPatterns = [
    /banner__orb/i, /banner__mesh/i, /banner__grid/i, /banner__noise/i,
    /pattern|texture|scan|stripes/i, /<svg/i,
  ];
  const decorHits = decorPatterns.filter((re) => re.test(html)).length;
  score += Math.min(8, decorHits * 2);

  return Math.min(99, Math.max(0, score));
}

// Generates a banner template — calls the configured model when an API key is
// set, otherwise returns the styled fallback. Always returns a valid template.
export async function generateBannerTemplate({
  supabase,
  prompt,
  style = "Modern",
  aspect = "16:9",
  variantSeed = 0,
  textModel: textModelOverride = null,
  systemPromptOverride = null,
  referenceContextText = null,
  subjectContextText = null,
  subjectImage = null,
}) {
  const styleRow = await getStyleByName(supabase, style);
  const styled   = enforceStaticBanner(
    applySubjectImage(
      ensureBgImageField(
        applyAspectToTemplate(applyStyleRow(FALLBACK_TEMPLATE, styleRow), aspect),
      ),
      subjectImage,
    ),
  );

  const adminClient = createAdminClient();
  const textModel = textModelOverride
    || (await getDefaultTextModelWithSecrets(adminClient));
  if (!textModel) {
    return {
      ...styled,
      generator: "fallback",
      reason: "No default text model is configured. Add one in Admin → Models.",
      styleRow,
    };
  }

  const apiKey   = pickApiKey(textModel);
  const endpoint = pickEndpoint(textModel);

  if (!apiKey) {
    return {
      ...styled,
      generator: "fallback",
      reason: `Model "${textModel.label}" has no API key. Set it in Admin → Models.`,
      styleRow,
    };
  }

  if (!endpoint && textModel.provider !== "openrouter") {
    return {
      ...styled,
      generator: "fallback",
      reason: `Provider "${textModel.provider}" needs an endpoint URL. Set config.endpoint in Admin → Models.`,
      styleRow,
    };
  }

  // Pull the entire prompt set (system, user scaffold, per-aspect guidance)
  // in one DB round-trip. Any DB override edited at /admin/prompt is
  // honored automatically; keys with no override fall back to the in-code
  // defaults defined in @/lib/prompts.
  const activePrompts = await getActivePrompts(adminClient).catch(() => null);
  if (systemPromptOverride && activePrompts) {
    activePrompts.bannerSystem = systemPromptOverride;
  }

  try {
    const messages = activePrompts
      ? composeBannerMessages({
          prompts:               activePrompts,
          brief:                 prompt,
          style,
          aspect,
          variantSeed,
          referenceContextText,
          subjectContextText,
        })
      : null;
    if (!messages) {
      return {
        ...styled,
        generator: "fallback",
        reason: "Could not load prompts from app_settings — using fallback template.",
        styleRow,
      };
    }
    const { content } = await callOpenRouter({
      apiKey,
      endpoint:    endpoint || undefined,
      model:       textModel.modelId,
      jsonMode:    true,
      temperature: textModel.config?.temperature ?? 0.9,
      maxTokens:   textModel.config?.maxTokens   ?? 6000,
      messages,
    });

    const parsed     = extractJson(content);
    const cleaned    = stripExternalImageUrls(parsed);
    const validated  = validateTemplate(cleaned);
    if (!validated) {
      return {
        ...styled,
        generator: "fallback",
        reason: "Model output failed validation (HTML too thin or invalid). Try again or pick a different model.",
        styleRow,
      };
    }
    const colorSafe  = enforceContrast(validated);
    const aspected   = applyAspectToTemplate(colorSafe, aspect);
    const withBgField = ensureBgImageField(aspected);
    const subjectApplied = applySubjectImage(withBgField, subjectImage);
    const staticSafe = enforceStaticBanner(subjectApplied);

    return {
      ...staticSafe,
      generator: textModel.label,
      modelId:   textModel.modelId,
      provider:  textModel.provider,
      styleRow,
    };
  } catch (e) {
    return {
      ...styled,
      generator: "fallback",
      reason: e?.message || "Model request failed",
      styleRow,
    };
  }
}
