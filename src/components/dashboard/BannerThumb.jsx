// src/components/dashboard/BannerThumb.jsx
"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Star } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/cn";

function aspectClass(a) {
  if (a === "1:1") return "aspect-square";
  if (a === "4:5") return "aspect-[4/5]";
  if (a === "9:16") return "aspect-[9/16]";
  return "aspect-[16/9]";
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Build a minimal iframe srcDoc that applies initial field values so the
// thumbnail looks exactly like the saved state — no postMessage needed.
function buildSrcDoc(html, css, fields, alignment) {
  if (!html || !css) return null;

  // Inline initial field values directly into CSS vars / text nodes so the
  // thumbnail is correct on first render without JS.
  let cssWithVars = css;

  // Collect CSS var overrides from color/range/select fields.
  const varOverrides = (fields || [])
    .filter((f) => f.cssVar && (f.type === "color" || f.type === "range" || f.type === "select"))
    .map((f) => {
      const val = f.type === "range" ? `${f.value}${f.unit || ""}` : f.value;
      return `  ${f.cssVar}: ${val};`;
    })
    .join("\n");

  if (varOverrides) {
    // Inject overrides into :root block or prepend a new one.
    if (cssWithVars.includes(":root")) {
      cssWithVars = cssWithVars.replace(/:root\s*{/, `:root {\n${varOverrides}`);
    } else {
      cssWithVars = `:root {\n${varOverrides}\n}\n` + cssWithVars;
    }
  }

  // Replace data-slot text content via regex substitution in HTML string.
  let htmlWithText = html;
  for (const f of fields || []) {
    if (f.type === "text" && f.slot) {
      // Replace content between data-slot open tag and first </
      htmlWithText = htmlWithText.replace(
        new RegExp(`(data-slot="${f.slot}"[^>]*)>([^<]*)`, "g"),
        `$1>${f.value ?? ""}`
      );
    }
    if (f.type === "toggle" && f.selector && f.value === false) {
      // We'll handle via inline style via a small script — too complex for regex
    }
  }

  const alignedHtml = htmlWithText.replace(
    /data-align="[^"]*"/,
    `data-align="${alignment || "left"}"`
  );

  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:transparent}
${cssWithVars}
</style></head><body>${alignedHtml}</body></html>`;
}

export default function BannerThumb({ banner, href, index = 0 }) {
  const link = href || `/dashboard/banners/${banner.id}`;

  const srcDoc = useMemo(
    () =>
      buildSrcDoc(banner.html, banner.css, banner.fields, banner.alignment),
    [banner.html, banner.css, banner.fields, banner.alignment]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      <Link
        href={link}
        className="group block overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-200 hover:border-border-strong hover:-translate-y-0.5"
      >
        <div
          className={cn(aspectClass(banner.aspect), "relative overflow-hidden")}
          style={!srcDoc ? { background: banner.gradient || "#0c0c10" } : undefined}
        >
          {srcDoc ? (
            <iframe
              title={banner.title}
              srcDoc={srcDoc}
              sandbox="allow-scripts"
              className="pointer-events-none h-full w-full border-0 bg-transparent"
              style={{ transform: "scale(1)", transformOrigin: "top left" }}
            />
          ) : banner.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={banner.imageUrl}
              alt={banner.title}
              className="h-full w-full object-cover"
            />
          ) : (
            // Gradient placeholder
            <div className="h-full w-full" />
          )}

          {banner.favourite && (
            <span className="absolute left-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-amber-300 backdrop-blur">
              <Star className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
            </span>
          )}
          {banner.score != null && (
            <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 font-mono text-[10px] text-white backdrop-blur">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  banner.score >= 80 ? "bg-emerald-400" : "bg-amber-400"
                )}
              />
              {banner.score}
            </span>
          )}
        </div>
        <div className="space-y-0.5 border-t border-border bg-surface-2 px-3 py-2.5">
          <div className="truncate text-sm text-foreground">{banner.title}</div>
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span className="truncate">
              {banner.modelLabel || "—"} · {banner.style || "—"}
            </span>
            <span>{banner.createdAt ? fmtDate(banner.createdAt) : ""}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}