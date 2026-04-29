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

// Build a srcDoc that pre-applies all field values so the thumbnail looks
// correct on first render — no postMessage handshake needed. Supports color,
// range, select, and image field types via CSS variable overrides; text via
// HTML substitution; toggle via inline display:none.
function buildSrcDoc(html, css, fields, alignment) {
  if (!html || !css) return null;

  let cssWithVars = css;

  const varOverrides = (fields || [])
    .filter(
      (f) =>
        f.cssVar &&
        (f.type === "color" ||
         f.type === "range" ||
         f.type === "select" ||
         f.type === "image"),
    )
    .map((f) => {
      let val = f.value;
      if (f.type === "range")  val = `${f.value}${f.unit || ""}`;
      // For image, the model is supposed to provide "url('https://...')" but
      // be forgiving if it's just a raw URL.
      if (f.type === "image") {
        const v = String(f.value || "").trim();
        if (v && !v.startsWith("url(")) val = `url("${v}")`;
        else val = v || "none";
      }
      return `  ${f.cssVar}: ${val};`;
    })
    .join("\n");

  if (varOverrides) {
    cssWithVars = cssWithVars.includes(":root")
      ? cssWithVars.replace(/:root\s*{/, `:root {\n${varOverrides}`)
      : `:root {\n${varOverrides}\n}\n` + cssWithVars;
  }

  // Append toggle hides as additional CSS.
  const toggleCss = (fields || [])
    .filter((f) => f.type === "toggle" && f.selector && f.value === false)
    .map((f) => `${f.selector} { display: none !important; }`)
    .join("\n");

  // Replace data-slot text content via regex substitution in HTML string.
  let htmlWithText = html;
  for (const f of fields || []) {
    if (f.type === "text" && f.slot) {
      htmlWithText = htmlWithText.replace(
        new RegExp(`(data-slot="${f.slot}"[^>]*)>([^<]*)`, "g"),
        `$1>${escapeHtml(f.value ?? "")}`,
      );
    }
  }

  const alignedHtml = htmlWithText.replace(
    /data-align="[^"]*"/,
    `data-align="${alignment || "left"}"`,
  );

  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
*{animation:none!important;transition:none!important}
html,body{width:100%;height:100%;overflow:hidden;background:transparent}
${cssWithVars}
${toggleCss}
</style></head><body>${alignedHtml}</body></html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function BannerThumb({ banner, href, index = 0 }) {
  const link = href || `/dashboard/banners/${banner.id}`;
  const isTopScore = banner.score != null && banner.score >= 80;

  const srcDoc = useMemo(
    () =>
      buildSrcDoc(banner.html, banner.css, banner.fields, banner.alignment),
    [banner.html, banner.css, banner.fields, banner.alignment],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.4,
        delay: index * 0.04,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
    >
      <Link
        href={link}
        className="group block overflow-hidden rounded-3xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_18px_60px_-46px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-[0_28px_80px_-48px_rgba(0,0,0,0.7)]"
      >
        <div className="p-2">
          <div
            className={cn(
              aspectClass(banner.aspect),
              "relative overflow-hidden rounded-[22px] border border-white/8 bg-surface-2",
            )}
            style={!srcDoc ? { background: banner.gradient || "#0c0c10" } : undefined}
          >
            {srcDoc ? (
              <iframe
                title={banner.title}
                srcDoc={srcDoc}
                sandbox="allow-scripts allow-same-origin"
                className="pointer-events-none h-full w-full border-0 bg-transparent"
              />
            ) : banner.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={banner.imageUrl}
                alt={banner.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full" />
            )}

            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_30%,rgba(0,0,0,0.16))]" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.52))]" />

            <div className="absolute left-3 top-3 flex flex-wrap gap-2">
              {banner.favourite && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] font-medium text-amber-300 backdrop-blur">
                  <Star className="h-3 w-3" fill="currentColor" strokeWidth={0} />
                  Favourite
                </span>
              )}
            </div>

            {banner.score != null && (
              <span className={cn(
                "absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] backdrop-blur",
                isTopScore
                  ? "border border-emerald-400/20 bg-emerald-400/12 text-emerald-200"
                  : "border border-amber-400/20 bg-amber-400/12 text-amber-200",
              )}>
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isTopScore ? "bg-emerald-400" : "bg-amber-400",
                  )}
                />
                Score {banner.score}
              </span>
            )}

            <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
              <div className="min-w-0 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-white/90 backdrop-blur-md">
                <div className="truncate text-sm font-medium text-white">{banner.title}</div>
                <div className="mt-0.5 truncate text-[11px] text-white/60">
                  {banner.modelLabel || "—"} · {banner.style || "—"}
                </div>
              </div>
              <div className="shrink-0 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white/70 backdrop-blur-md">
                {banner.createdAt ? fmtDate(banner.createdAt) : "New"}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}