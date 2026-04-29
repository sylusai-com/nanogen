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

// Build the full HTML document the iframe would have shown, with the
// patched field values applied to the markup and the chosen alignment set.
export function buildStandaloneHtml({ html, css, fields = [], alignment = "left", title = "banner" }) {
  let cssOut = css || "";
  const overrides = fields
    .filter((f) => f.cssVar)
    .map((f) => {
      let val = f.type === "range" ? `${f.value}${f.unit || ""}` : f.value;
      if (f.type === "image") {
        const raw = String(f.value || "").trim();
        val = raw
          ? raw.startsWith("url(")
            ? raw
            : `url("${raw}")`
          : "none";
      }
      return `  ${f.cssVar}: ${val};`;
    })
    .join("\n");
  if (overrides) {
    cssOut = cssOut.includes(":root")
      ? cssOut.replace(/:root\s*{/, `:root {\n${overrides}`)
      : `:root {\n${overrides}\n}\n` + cssOut;
  }

  let htmlOut = html || "";
  for (const f of fields) {
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
  width = 1600,
  height = 900,
}) {
  const standalone = buildStandaloneHtml({ html, css, fields, alignment });
  // Strip the doctype / outer html — foreignObject wants a fragment.
  const inner = standalone
    .replace(/^[\s\S]*?<body[^>]*>/i, "")
    .replace(/<\/body>[\s\S]*$/i, "");
  const cssMatch = standalone.match(/<style>([\s\S]*?)<\/style>/i);
  const styleBlock = cssMatch ? `<style>${cssMatch[1]}</style>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject x="0" y="0" width="${width}" height="${height}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px">
      ${styleBlock}
      ${inner}
    </div>
  </foreignObject>
</svg>`;
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

// Rasterize the SVG to a PNG/JPEG data URL.
export async function rasterize({
  html,
  css,
  fields,
  alignment,
  aspect = "16:9",
  format = "image/png",
  scale = 1,
  background = "#ffffff",
}) {
  if (typeof window === "undefined") {
    throw new Error("rasterize() must be called from the browser.");
  }
  const { width, height } = exportSize(aspect);
  const safeFields = await inlineImageFields(fields || []);
  const svg = buildSvgString({ html, css, fields: safeFields, alignment, width, height });

  // Use a Blob URL — embedding via data: URI breaks cross-origin images
  // (Unsplash) because they're loaded under the SVG document's origin.
  const blob   = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url    = URL.createObjectURL(blob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width  = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (format === "image/jpeg") {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(format, format === "image/jpeg" ? 0.92 : undefined);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}

async function inlineImageFields(fields) {
  const next = [];
  for (const field of fields) {
    if (field?.type !== "image") {
      next.push(field);
      continue;
    }
    const raw = String(field.value || "").trim();
    if (!raw || raw.startsWith("data:") || raw.startsWith("url(data:")) {
      next.push(field);
      continue;
    }
    const cleanUrl = raw.startsWith("url(")
      ? raw.replace(/^url\(["']?/, "").replace(/["']?\)$/, "")
      : raw;
    try {
      const res = await fetch(cleanUrl, { mode: "cors" });
      if (!res.ok) {
        next.push(field);
        continue;
      }
      const blob = await res.blob();
      const dataUrl = await blobToDataUrl(blob);
      next.push({ ...field, value: `url("${dataUrl}")` });
    } catch {
      next.push(field);
    }
  }
  return next;
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
  html, css, fields, alignment, aspect = "16:9",
}) {
  const { width, height } = exportSize(aspect);
  const dataUrl = await rasterize({
    html, css, fields, alignment, aspect,
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
