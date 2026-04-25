import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Phase 2 stub: generate an HTML banner template + editable fields.
// Replace the body below with a real LLM call (e.g. Anthropic / OpenAI chat
// completion) prompted to return JSON in this exact shape.
//
// Response shape:
//   {
//     html: string,
//     css: string,
//     fields: Array<{
//       id, type: "text" | "color",
//       label, value,
//       cssVar?: string,        // for color fields
//       slot?: string,          // for text fields, matches data-slot in html
//     }>,
//     alignment: "left" | "center" | "right",
//   }

const TEMPLATE_HTML = `
<div class="banner" data-align="left">
  <div class="banner__bg"></div>
  <div class="banner__inner">
    <span class="banner__eyebrow" data-slot="eyebrow">NEW</span>
    <h1 class="banner__headline" data-slot="headline">Headline goes here</h1>
    <p class="banner__subhead" data-slot="subhead">Subhead supporting copy.</p>
    <a class="banner__cta" data-slot="cta">Get started</a>
  </div>
</div>
`.trim();

const TEMPLATE_CSS = `
:root {
  --bg: #0c0c10;
  --fg: #ffffff;
  --muted: rgba(255,255,255,0.65);
  --accent: #a78bfa;
  --cta-fg: #0a0a0b;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: transparent; }
body { font-family: 'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif; }
.banner {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
  overflow: hidden;
  border-radius: 14px;
  background: var(--bg);
  color: var(--fg);
}
.banner__bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(60% 80% at 0% 0%, color-mix(in oklab, var(--accent) 35%, transparent) 0%, transparent 60%),
    radial-gradient(40% 60% at 100% 100%, color-mix(in oklab, var(--accent) 20%, transparent) 0%, transparent 60%);
}
.banner__inner {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 8% 7%;
  gap: 14px;
}
.banner[data-align="center"] .banner__inner { align-items: center; text-align: center; }
.banner[data-align="right"] .banner__inner { align-items: flex-end; text-align: right; }
.banner__eyebrow {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  border: 1px solid color-mix(in oklab, var(--accent) 40%, transparent);
  padding: 4px 10px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--accent) 12%, transparent);
}
.banner__headline {
  font-size: clamp(28px, 6vw, 56px);
  line-height: 1.04;
  letter-spacing: -0.02em;
  font-weight: 600;
  margin: 0;
}
.banner__subhead {
  margin: 0;
  font-size: clamp(14px, 1.6vw, 18px);
  color: var(--muted);
  max-width: 56ch;
}
.banner__cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--accent);
  color: var(--cta-fg);
  padding: 10px 18px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  width: fit-content;
}
`.trim();

function deriveCopy(prompt) {
  const head =
    prompt.length > 60 ? prompt.slice(0, 60).trim() + "…" : prompt || "Launch day is here";
  return {
    eyebrow: "NEW",
    headline: head.replace(/^./, (c) => c.toUpperCase()),
    subhead: "Auto-generated from your prompt — edit any field to fine-tune.",
    cta: "Get started",
  };
}

const STYLE_PRESETS = {
  Modern:     { bg: "#0c0c10", fg: "#ffffff", accent: "#a78bfa" },
  Minimal:    { bg: "#fafafa", fg: "#0a0a0b", accent: "#7c3aed" },
  Cyberpunk:  { bg: "#0a0019", fg: "#fff7ff", accent: "#ec4899" },
  Editorial:  { bg: "#0a0e1f", fg: "#fff8e7", accent: "#f59e0b" },
  Playful:    { bg: "#1a0033", fg: "#fff7ff", accent: "#22d3ee" },
  Corporate:  { bg: "#0b1220", fg: "#f8fafc", accent: "#3b82f6" },
};

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { prompt = "", style = "Modern", aspect = "16:9" } = body || {};
  const preset = STYLE_PRESETS[style] || STYLE_PRESETS.Modern;
  const copy = deriveCopy(prompt);

  return NextResponse.json({
    html: TEMPLATE_HTML,
    css: TEMPLATE_CSS,
    aspect,
    alignment: "left",
    fields: [
      { id: "eyebrow", type: "text", slot: "eyebrow", label: "Eyebrow", value: copy.eyebrow },
      { id: "headline", type: "text", slot: "headline", label: "Headline", value: copy.headline },
      { id: "subhead", type: "text", slot: "subhead", label: "Subhead", value: copy.subhead },
      { id: "cta", type: "text", slot: "cta", label: "CTA", value: copy.cta },
      { id: "bg", type: "color", cssVar: "--bg", label: "Background", value: preset.bg },
      { id: "fg", type: "color", cssVar: "--fg", label: "Text", value: preset.fg },
      { id: "accent", type: "color", cssVar: "--accent", label: "Accent", value: preset.accent },
    ],
  });
}
