// src/lib/bannerDownload.js
// Client-side banner export helpers — no third-party dependencies.
//
// Strategy:
//  - HTML  → serialize the rendered banner as a self-contained .html file
//            with all CSS inlined (just a wrapper around the existing
//            template html + css).
//  - SVG   → embed the rendered banner inside an <svg><foreignObject>…
//            so it remains scalable / editable in design tools.
//  - PNG / JPEG → rasterize the SVG via an offscreen <canvas>. Works in
//            modern browsers, no external libs.
//  - PDF   → generate a minimal one-page PDF embedding the PNG. Custom
//            ~80-line PDF writer below avoids pulling in jsPDF.
//
// All exports are triggered from the browser; this module is "use client"
// safe and never imported on the server.

import { toJpeg, toPng } from "html-to-image";

function getFieldTextValue(field) {
  const value = field?.value;
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    return String(value.dataUrl || value.url || value.value || "").trim();
  }
  return String(value).trim();
}

function getFieldCssValue(field) {
  if (!field) return "";
  if (field.type === "range") {
    return `${field.value}${field.unit || ""}`;
  }
  if (field.type === "image") {
    const raw = getFieldTextValue(field);
    if (!raw) return "none";
    return raw.startsWith("url(") ? raw : `url("${raw}")`;
  }
  return getFieldTextValue(field);
}

function getFieldCssVar(field) {
  return field?.cssVar || (field?.id === "bg_image" ? "--bg-image" : "");
}

function wrapImageUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  return value.startsWith("url(") ? value : `url("${value}")`;
}

function normalizeRenderFields(fields = [], subjectImageUrl = null) {
  const next = (fields || []).map((field) => ({ ...field }));
  if (!subjectImageUrl) return next;

  const wrapped = wrapImageUrl(subjectImageUrl);
  if (!wrapped) return next;

  const bgField = next.find((field) => field?.id === "bg_image");
  if (bgField) {
    bgField.value = wrapped;
  } else {
    // If no explicit bg_image field exists, add one so CSS var overrides
    // and template background-image usage pick up the provided subject/bg.
    next.push({
      id: "bg_image",
      type: "image",
      cssVar: "--bg-image",
      slot: "bg_image",
      label: "Background image",
      value: wrapped,
    });
  }

  // Keep subject rendering deterministic: only bg_image/--bg-image is
  // populated from the subject data URI. Do not fan out to other fields.
  return next;
}

function getFieldById(fields, id) {
  return (fields || []).find((field) => field?.id === id) || null;
}

function renderCanvasElementMarkup(el) {
  if (!el) return "";
  const style = el.style || {};
  const posStyle = `position:absolute;left:${el.x}%;top:${el.y}%;width:${el.w}%;${el.h ? `height:${el.h}%;` : ""}`;
  switch (el.type) {
    case "text":
      return `<div class="banner__el banner__text" data-id="${el.id}" style="${posStyle}font-size:${style.fontSize||"16px"};font-weight:${style.fontWeight||"400"};color:${style.color||"#fff"};text-align:${style.textAlign||"left"};line-height:${style.lineHeight||1.4}">${escapeHtml(el.content||"")}</div>`;
    case "rect":
      return `<div class="banner__el banner__rect" data-id="${el.id}" style="${posStyle}background:${style.background||"#a78bfa"};border-radius:${style.borderRadius||"8px"};opacity:${style.opacity??1}"></div>`;
    case "button":
      return `<div class="banner__el banner__button" data-id="${el.id}" style="${posStyle}display:inline-flex;align-items:center;justify-content:center;background:${style.background||"#a78bfa"};color:${style.color||"#fff"};border-radius:${style.borderRadius||"999px"};font-size:${style.fontSize||"14px"};font-weight:${style.fontWeight||"600"}">${escapeHtml(el.content||"Button")}</div>`;
    case "image":
      return `<div class="banner__el banner__image" data-id="${el.id}" style="${posStyle}overflow:hidden;border-radius:${style.borderRadius||"8px"}"><img src="${escapeAttr(el.content||"")}" alt="" style="width:100%;height:100%;object-fit:cover"></div>`;
    case "divider":
      return `<div class="banner__el banner__divider" data-id="${el.id}" style="${posStyle}height:${style.thickness||"2px"};background:${style.color||"rgba(255,255,255,0.2)"};border-radius:999px"></div>`;
    default:
      return "";
  }
}

function renderCanvasElementsMarkup(elements = []) {
  return (elements || []).map((el) => renderCanvasElementMarkup(el)).join("\n");
}

function extractBodyInner(docHtml) {
  const match = String(docHtml || "").match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : "";
}

function extractStyleBlock(docHtml) {
  const match = String(docHtml || "").match(/<style>([\s\S]*?)<\/style>/i);
  return match ? match[1] : "";
}

// Build the full HTML document the iframe would have shown, with the
// patched field values applied to the markup and the chosen alignment set.
export function buildStandaloneHtml({ html, css, fields = [], alignment = "left", title = "banner", hideSlots = false, subjectImageUrl = null }) {
  let cssOut = css || "";
  const renderFields = normalizeRenderFields(fields, subjectImageUrl);
  const forcedSubjectBg = wrapImageUrl(subjectImageUrl);
  // The "effective" bg image is whatever should be rendered: prefer the
  // explicit subjectImageUrl (user upload) and fall back to whatever value
  // a bg_image field already carries (AI-generated or provider-fetched
  // photo lands here through applySubjectImage()).
  const bgField = renderFields.find((f) => f?.id === "bg_image" || getFieldCssVar(f) === "--bg-image");
  const bgFieldCssValue = bgField ? getFieldCssValue(bgField) : "";
  // Subject layer (--subject-image): set when the route layered both a
  // photographic bg AND a separate cleaned subject cutout. The subject
  // gets its own var so it stacks ABOVE the bg image, instead of
  // replacing it like in the legacy single-layer path.
  const subjectField = renderFields.find((f) => f?.id === "subject_image" || getFieldCssVar(f) === "--subject-image");
  const subjectFieldCssValue = subjectField ? getFieldCssValue(subjectField) : "";
  const effectiveSubject = subjectFieldCssValue && subjectFieldCssValue !== "none" ? subjectFieldCssValue : "";
  const effectiveBg = forcedSubjectBg
    || (bgFieldCssValue && bgFieldCssValue !== "none" ? bgFieldCssValue : "");

  const overrides = renderFields
    .filter((f) => getFieldCssVar(f))
    .map((f) => {
      return `  ${getFieldCssVar(f)}: ${getFieldCssValue(f)};`;
    })
    .join("\n");
  // When a subject image is present, force `contain` sizing so the whole
  // subject (head, hair, full body, etc.) renders inside whatever layer
  // the model created. Models frequently set --bg-zoom to 100% or 110%
  // which crops portrait subjects — overriding the variable here means
  // every `background-size: var(--bg-zoom, …)` consumer gets `contain`
  // automatically. We also normalize --bg-position to "center" because
  // "center bottom" / "bottom" on a contain-sized image leaves an empty
  // band at the top instead of fitting the subject.
  const subjectLayoutOverrides = forcedSubjectBg
    ? `  --bg-zoom: contain;\n  --bg-position: center;`
    : "";
  const mergedOverrides = [
    forcedSubjectBg ? `  --bg-image: ${forcedSubjectBg};` : "",
    subjectLayoutOverrides,
    overrides,
  ].filter(Boolean).join("\n");
  if (mergedOverrides) {
    // Append a *second* :root block AFTER the template's CSS so our
    // values win the cascade. Models often hard-code defaults like
    // `--bg-image: none` further down inside their own :root, and
    // prepending overrides at the top means the later declaration wins
    // — which silently blanks out the subject image. Putting our block
    // last guarantees the override sticks regardless of where the model
    // declared the variable.
    cssOut = `${cssOut}\n:root {\n${mergedOverrides}\n}\n`;
  }

  // Catch-all for templates that hard-code background-size (ignoring
  // --bg-zoom) on the subject layer. Forces the full subject to show
  // and prevents the "head/hair cut off" symptom when models pick
  // overly aggressive cover sizing.
  if (forcedSubjectBg) {
    cssOut += `
.banner [class*="subject"],
.banner [class*="bg-image"],
.banner__subject,
.banner__bg-image {
  background-size: contain !important;
  background-position: center center !important;
  background-repeat: no-repeat !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
}
`;
  }

  // Single-layer fallback for templates that don't wire a dedicated
  // bg-image layer themselves. We render `.banner::before` only when the
  // template's HTML doesn't already contain a `.banner__bg-image` element
  // and its CSS doesn't already consume `var(--bg-image)` — otherwise the
  // fallback would stack a second copy of the photo on top of the first.
  const templateHasBgLayer =
    /class="[^"]*banner__bg-image[^"]*"/i.test(html || "") ||
    /background-image\s*:\s*var\(\s*--bg-image\s*\)/i.test(cssOut);
  if (effectiveBg && !templateHasBgLayer) {
    cssOut += `\n.banner::before { content:""; position:absolute; inset:0; z-index:-2; background-image:${effectiveBg} !important; background-size:var(--bg-zoom,110%); background-position:var(--bg-position,center center); background-repeat:no-repeat; filter:brightness(var(--bg-brightness,0.75)) blur(var(--bg-blur,0px)); transform:scale(1.03); }`;
    cssOut += `\n.banner::after  { content:""; position:absolute; inset:0; z-index:-1; background:linear-gradient(180deg, transparent, rgba(0,0,0,calc(var(--bg-overlay,0.45) * 0.9)), rgba(0,0,0,var(--bg-overlay,0.45))); pointer-events:none; }`;
  }

  // Subject overlay. When the layered path produced a separate cutout
  // we always inject our own subject layer (templates don't yet emit
  // .banner__subject-image of their own). The layer sits above the bg
  // image and decoration, with `contain` sizing so the entire subject
  // is visible. We render this whether or not the model template
  // happens to declare one — it wins the cascade with `!important`.
  if (effectiveSubject) {
    cssOut += `
.banner__subject-image-injected {
  position: absolute !important;
  inset: 0 !important;
  z-index: 6 !important;
  background-image: ${effectiveSubject} !important;
  background-size: contain !important;
  background-position: center center !important;
  background-repeat: no-repeat !important;
  pointer-events: none !important;
}
`;
  }

  if (hideSlots) {
    cssOut += `\n\n[data-slot] { visibility: hidden !important; pointer-events: none !important; }\n[data-slot] * { visibility: hidden !important; }\n`;
  }

  let htmlOut = html || "";
  for (const f of renderFields) {
    if (f.type === "text" && f.slot) {
      htmlOut = htmlOut.replace(
        new RegExp(`(data-slot="${f.slot}"[^>]*)>([^<]*)`, "g"),
        `$1>${escapeText(f.value ?? "")}`,
      );
    }
    if (f.type === "toggle" && f.selector && f.value === false) {
      // Inline display:none on toggled-off elements so the static export
      // matches what the iframe was showing.
      htmlOut = htmlOut.replace(
        new RegExp(`(class="[^"]*${escapeRegex(f.selector.replace(/^\./, ""))}[^"]*")`, "g"),
        `$1 style="display:none"`,
      );
    }
  }
  htmlOut = htmlOut.replace(/data-align="[^"]*"/, `data-align="${alignment}"`);

  // Inject the cleaned-subject overlay div near the end of `.banner` so
  // it stacks above the model's bg layers without disturbing the rest
  // of the markup. Only added when --subject-image is actually set.
  if (effectiveSubject) {
    htmlOut = htmlOut.replace(
      /<\/div>\s*$/,
      `<div class="banner__subject-image-injected"></div></div>`,
    );
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeText(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    * { animation: none !important; transition: none !important; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
    body { font-family: 'Geist', ui-sans-serif, system-ui, sans-serif; }
${cssOut}
  </style>
</head>
<body>
${htmlOut}
</body>
</html>`;
}

// Build an <svg> wrapper containing the banner via <foreignObject>. The
// SVG is rendered at the requested pixel size — used both as the SVG
// export and as the source for canvas rasterization.
export function buildSvgString({
  html,
  css,
  fields = [],
  alignment = "left",
  subjectImageUrl = null,
  elements = [],
  canvasBackground = "#0c0c10",
  aspect = "16:9",
  width = 1600,
  height = 900,
}) {
  const standalone = buildCompositeStandaloneHtml({
    html, css, fields, alignment, subjectImageUrl, elements, background: canvasBackground, aspect,
  });
  // Strip the doctype / outer html — foreignObject wants a fragment.
  const inner = standalone
    .replace(/^[\s\S]*?<body[^>]*>/i, "")
    .replace(/<\/body>[\s\S]*$/i, "");
  const cssMatch = standalone.match(/<style>([\s\S]*?)<\/style>/i);
  const styleBlock = cssMatch ? `<style>${cssMatch[1]}</style>` : "";

  // Lay out the inner DOM at the design render size so vw-based clamps
  // resolve to the same values as the in-app preview, then let the SVG
  // viewBox scale the result up to the requested export size.
  const render = exportRenderSize(aspect);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${render.width} ${render.height}">
  <foreignObject x="0" y="0" width="${render.width}" height="${render.height}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${render.width}px;height:${render.height}px">
      ${styleBlock}
      ${inner}
    </div>
  </foreignObject>
</svg>`;
}

// Build HTML/CSS parts from a builder-style canvas (elements + background).
// Returns an object { html, css } where `html` is the banner markup
// (root element expected to be inserted into an iframe body) and `css`
// contains the styles that should be applied. This mirrors the shape
// used by the editor/template system so builder exports can be saved
// back into the banner row.
export function buildTemplateFromCanvas({ elements = [], background = "#0c0c10", aspect = "16:9", fields = [] }) {
  const [w, h] = (aspect || "16:9").split(":").map(Number);
  const pct = (h / w) * 100;

  const rootOverrides = fields
    .filter((f) => getFieldCssVar(f))
    .map((f) => `  ${getFieldCssVar(f)}: ${getFieldCssValue(f)};`)
    .join("\n");
  const bgFieldValue = getFieldTextValue(fields.find((f) => f.id === "bg"));
  const bgColor = bgFieldValue || ((typeof background === "string" && /^(?:data:image\/|https?:\/\/)/i.test(background.trim())) ? "#0c0c10" : background);

  // If a background string looks like an image URL or data URI, expose it
  // as the CSS `--bg-image` variable so the template's background image
  // layer renders. Otherwise, detect bg_image fields as before.
  let bgImageUrl = null;
  if (typeof background === "string") {
    const b = background.trim();
    if (b.startsWith("data:image/") || /^https?:\/\//i.test(b)) {
      bgImageUrl = wrapImageUrl(b);
    }
  }

  const hasBgImage = Boolean(bgImageUrl) || fields.some((f) => f.id === "bg_image" || getFieldCssVar(f) === "--bg-image");
  // If we have an explicit bg image URL from the canvas/background param,
  // ensure it's added to the root overrides so CSS var is present.
  const explicitBgOverride = bgImageUrl ? `  --bg-image: ${bgImageUrl};\n` : "";
  const css = `${rootOverrides || explicitBgOverride ? `:root {\n${explicitBgOverride}${rootOverrides ? rootOverrides + "\n" : ""}}\n` : ""}*{box-sizing:border-box;margin:0;padding:0}body{font-family:Geist,ui-sans-serif,system-ui,sans-serif}.banner{position:relative;isolation:isolate;width:100%;padding-bottom:${pct.toFixed(2)}%;background:${bgColor}}.banner-inner{position:absolute;inset:0}${hasBgImage ? `\n.banner::before{content:"";position:absolute;inset:0;z-index:-2;background-image:var(--bg-image);background-size:var(--bg-zoom,110%);background-position:var(--bg-position,center center);background-repeat:no-repeat;filter:brightness(var(--bg-brightness,0.75)) blur(var(--bg-blur,0px));transform:scale(1.03)}.banner::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(to bottom,rgba(0,0,0,calc(var(--bg-overlay,0.45)*0.9)),rgba(0,0,0,var(--bg-overlay,0.45)))}` : ""}`;

  const innerHtml = renderCanvasElementsMarkup(elements);

  const html = `<div class=\"banner\"> <div class=\"banner-inner\">${innerHtml}</div></div>`;
  return { html, css };
}

export function buildCompositeStandaloneHtml({
  html,
  css,
  fields = [],
  alignment = "left",
  title = "banner",
  subjectImageUrl = null,
  elements = [],
  aspect = "16:9",
  background = "#0c0c10",
}) {
  const hasOverlay = elements.length > 0;
  // Slots are intentionally NOT hidden when an overlay exists — keeping
  // every AI-generated decoration visible (orbs, eyebrow chips, version
  // tags, feature pills, trust avatars) is what makes the rendering
  // identical in the list view, the detail view, the builder, and
  // every download format. Canvas elements layer on top as additions.
  const baseDoc = html && css
    ? buildStandaloneHtml({ html, css, fields, alignment, title, subjectImageUrl })
    : buildStandaloneHtml({
        ...buildTemplateFromCanvas({ elements: [], background, aspect, fields }),
        fields,
        alignment,
        title,
        subjectImageUrl,
      });

  const shellStyle = `position:relative;width:100%;height:100%;overflow:hidden;`;
  const overlayStyle = `position:absolute;inset:0;z-index:5;`;
  const inner = extractBodyInner(baseDoc);
  const styles = `${extractStyleBlock(baseDoc)}
.banner-shell{${shellStyle}}
.banner-components{${overlayStyle}}
.banner-components .banner__el{pointer-events:none}`;

  if (!hasOverlay) {
    return baseDoc;
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeText(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    * { animation: none !important; transition: none !important; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
    body { font-family: 'Geist', ui-sans-serif, system-ui, sans-serif; }
${styles}
  </style>
</head>
<body>
  <div class="banner-shell">
${inner}
    <div class="banner-components">
${renderCanvasElementsMarkup(elements)}
    </div>
  </div>
</body>
</html>`;
}

export function extractEditableComponentsFromDocument(doc, { fields = [] } = {}) {
  if (!doc?.querySelector) return [];
  const root = doc.querySelector(".banner") || doc.body || doc.documentElement;
  if (!root?.getBoundingClientRect) return [];

  const rootRect = root.getBoundingClientRect();
  const slots = Array.from(doc.querySelectorAll("[data-slot]"));
  const fieldIds = new Set((fields || []).map((field) => field?.id));

  return slots
    .map((node) => {
      const slot = node.getAttribute("data-slot");
      if (!slot || !fieldIds.has(slot)) return null;
      if (slot === "bg_image") return null;

      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height || !rootRect.width || !rootRect.height) return null;

      const field = getFieldById(fields, slot);
      const computed = doc.defaultView?.getComputedStyle(node);
      const type = /cta/i.test(slot) || node.tagName === "A" ? "button" : "text";

      return {
        id: `template:${slot}`,
        type,
        x: ((rect.left - rootRect.left) / rootRect.width) * 100,
        y: ((rect.top - rootRect.top) / rootRect.height) * 100,
        w: (rect.width / rootRect.width) * 100,
        h: type === "text" ? null : (rect.height / rootRect.height) * 100,
        content: getFieldTextValue(field) || node.textContent?.trim() || "",
        style: {
          color: computed?.color || "#ffffff",
          background: type === "button" ? (computed?.backgroundColor || "#a78bfa") : undefined,
          borderRadius: type === "button" ? (computed?.borderRadius || "999px") : undefined,
          fontSize: computed?.fontSize || "16px",
          fontWeight: computed?.fontWeight || "400",
          textAlign: computed?.textAlign || "left",
          lineHeight: computed?.lineHeight || "1.4",
          letterSpacing: computed?.letterSpacing || "normal",
        },
      };
    })
    .filter(Boolean);
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
function escapeAttr(s) {
  return String(s || "").replace(/"/g, "&quot;");
}

// Common aspect → pixel sizes for export. Higher is sharper; we cap at
// 1920px on the long edge for sane file sizes.
export function exportSize(aspect = "16:9") {
  switch (aspect) {
    case "1:1":  return { width: 1280, height: 1280 };
    case "4:5":  return { width: 1280, height: 1600 };
    case "9:16": return { width: 1080, height: 1920 };
    default:     return { width: 1920, height: 1080 };
  }
}

// CSS-pixel size at which the export iframe lays out its DOM. Picked to
// match the typical in-app preview width so viewport-relative units
// (vw, %, clamp) resolve to the same values the user sees in preview.
// Pixel-ratio scaling on top yields a high-resolution raster.
export function exportRenderSize(aspect = "16:9") {
  const [w, h] = String(aspect).split(":").map(Number);
  const designWidth = 900;
  if (!w || !h) return { width: designWidth, height: Math.round((designWidth * 9) / 16) };
  return { width: designWidth, height: Math.round((designWidth * h) / w) };
}

// Rasterize the SVG to a PNG/JPEG data URL.
export async function rasterize({
  html,
  css,
  fields,
  alignment,
  subjectImageUrl = null,
  elements = [],
  canvasBackground = "#0c0c10",
  aspect = "16:9",
  format = "image/png",
  scale = 1,
  background = "#ffffff",
}) {
  if (typeof window === "undefined") {
    throw new Error("rasterize() must be called from the browser.");
  }
  try {
    const { node, cleanup } = await createBannerRenderNode({
      html, css, fields, alignment, subjectImageUrl, aspect, elements, canvasBackground,
    });
    try {
      const target = exportSize(aspect);
      const render = exportRenderSize(aspect);
      // Lay out at design size, scale the raster up to the export
      // resolution. `scale` multiplies on top for retina sharpness.
      const pixelRatio = (target.width / render.width) * scale;
      const options = {
        cacheBust: true,
        pixelRatio,
        backgroundColor: background,
      };
      if (format === "image/jpeg") {
        return await toJpeg(node, { ...options, quality: 0.92 });
      }
      return await toPng(node, options);
    } finally {
      cleanup();
    }
  } finally {
  }
}

async function createBannerRenderNode({
  html, css, fields, alignment, subjectImageUrl = null, aspect, elements = [], canvasBackground = "#0c0c10",
}) {
  if (typeof document === "undefined") {
    throw new Error("createBannerRenderNode() must be called from the browser.");
  }

  const { width, height } = exportRenderSize(aspect);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = `${width}px`;
  iframe.style.height = `${height}px`;
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";

  const doc = buildCompositeStandaloneHtml({
    html, css, fields, alignment, subjectImageUrl,
    title: "banner-export",
    elements, aspect,
    background: canvasBackground,
  });
  document.body.appendChild(iframe);

  await new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Banner export timed out")), 15000);
    iframe.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    iframe.srcdoc = doc;
  });

  const docRoot = iframe.contentDocument;
  if (docRoot?.fonts?.ready) {
    try {
      await docRoot.fonts.ready;
    } catch {
      // Font loading is best-effort; export should still proceed with fallbacks.
    }
  }
  await inlineImageVariables(docRoot, fields || []);
  const images = Array.from(docRoot?.images || []);
  await Promise.all(
    images.map((img) => (
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
    )),
  );

  const node =
    docRoot?.querySelector?.(".banner-shell") ||
    docRoot?.querySelector?.(".banner") ||
    docRoot?.body ||
    docRoot?.documentElement;
  if (!node) {
    iframe.remove();
    throw new Error("Banner export node unavailable");
  }

  return {
    node,
    cleanup: () => iframe.remove(),
  };
}

async function inlineImageVariables(docRoot, fields) {
  if (!docRoot?.documentElement) return;

  for (const field of fields) {
    if (field?.type !== "image" || !field.cssVar) continue;
    const raw = String(field.value || "").trim();
    if (!raw || raw.startsWith("data:")) continue;

    const cleanUrl = raw.startsWith("url(")
      ? raw.replace(/^url\(["']?/, "").replace(/["']?\)$/, "")
      : raw;

    try {
      const res = await fetch(cleanUrl, { mode: "cors", cache: "no-store" });
      if (!res.ok) continue;
      const blob = await res.blob();
      const dataUrl = await blobToDataUrl(blob);
      docRoot.documentElement.style.setProperty(field.cssVar, `url("${dataUrl}")`);
    } catch {
      // Best effort: keep the original URL if inlining fails.
    }
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image blob"));
    reader.readAsDataURL(blob);
  });
}

// Trigger a browser download from a string or data URL.
export function triggerDownload(filename, data, mime = "text/plain") {
  if (typeof window === "undefined") return;
  let href = data;
  let cleanup = () => {};
  if (typeof data === "string" && !data.startsWith("data:") && !data.startsWith("blob:")) {
    const blob = new Blob([data], { type: mime });
    href = URL.createObjectURL(blob);
    cleanup = () => URL.revokeObjectURL(href);
  }
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(cleanup, 1000);
}

// Generate a minimal single-page PDF that embeds a JPEG of the banner.
// The generated PDF is intentionally simple: one page, banner fills the
// page, no metadata/fonts. Avoids the ~150KB jsPDF dep entirely.
export async function rasterizeToPdf({
  html, css, fields, alignment, subjectImageUrl = null, aspect = "16:9",
  elements = [], canvasBackground = "#0c0c10",
}) {
  const { width, height } = exportSize(aspect);
  const dataUrl = await rasterize({
    html, css, fields, alignment, subjectImageUrl, aspect,
    elements, canvasBackground,
    format: "image/jpeg",
    scale: 1,
    background: "#ffffff",
  });
  const jpegBytes = dataUrlToBytes(dataUrl);
  return buildPdfWithJpeg(jpegBytes, width, height);
}

function dataUrlToBytes(url) {
  const base64 = url.split(",")[1] || "";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Minimal PDF 1.4 document with a single XObject image. Reverse-engineered
// from the PDF 1.4 spec — emits a compliant catalog / pages / page /
// content stream / image (DCTDecode/JPEG) / and xref table.
function buildPdfWithJpeg(jpegBytes, width, height) {
  const enc    = new TextEncoder();
  const chunks = [];
  let pos = 0;
  const offsets = [];

  const push = (data) => {
    const arr = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(arr);
    pos += arr.length;
  };
  const writeObject = (id, body) => {
    offsets[id] = pos;
    push(`${id} 0 obj\n${body}\nendobj\n`);
  };

  // PDF header
  push("%PDF-1.4\n%\xC2\xB5\xC2\xB5\xC2\xB5\xC2\xB5\n");

  // 1 catalog
  writeObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  // 2 pages
  writeObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  // 3 page
  writeObject(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
      `/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`,
  );
  // 4 content stream — paint Im0 to fill the page
  const contentStream = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
  writeObject(
    4,
    `<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream`,
  );
  // 5 image XObject (JPEG)
  offsets[5] = pos;
  push(
    `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
      `/Length ${jpegBytes.length} >>\nstream\n`,
  );
  push(jpegBytes);
  push("\nendstream\nendobj\n");

  // xref
  const xrefStart = pos;
  push(`xref\n0 6\n0000000000 65535 f \n`);
  for (let i = 1; i <= 5; i++) {
    push(String(offsets[i]).padStart(10, "0") + " 00000 n \n");
  }
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  // Concat chunks → Uint8Array → Blob
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out   = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return new Blob([out], { type: "application/pdf" });
}

function escapeText(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
function escapeRegex(s) {
  return String(s).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}
