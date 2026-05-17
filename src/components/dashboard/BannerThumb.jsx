// src/components/dashboard/BannerThumb.jsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { setCached, getCached } from "@/lib/cache";

// Lightweight static card — replaces the previous iframe-per-banner
// preview that was crushing the gallery's main thread. Each thumb now
// renders as a stack of CSS layers + (at most) a single <img> background
// instead of mounting a full HTML/CSS sandbox.
//
// What we pull from the banner row (all already in LIST_COLUMNS):
//   - banner.imageUrl: the bg photo URL (the strongest visual identifier
//     when the banner has a photographic background). Rendered as an
//     <img> with native lazy loading.
//   - banner.fields: scanned for bg / accent / fg colour values so the
//     card colour-matches the actual banner even when there's no bg
//     photo. Cheaper than parsing CSS or rendering the template.
//   - banner.gradient: fallback colour stop when neither of the above
//     is set (very old rows or pure-gradient banners).
//
// The user still sees the real banner — fully rendered with the iframe —
// when they click into the detail or builder page.

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

// Strip a `url("…")` wrapper if the field value carries one (most do)
// and return the bare URL. Returns "" when there's nothing usable.
function unwrapUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "none") return "";
  const m = raw.match(/^url\(\s*["']?(.*?)["']?\s*\)$/i);
  const inner = (m ? m[1] : raw).trim();
  if (!inner || inner === "none") return "";
  if (!/^(?:https?:\/\/|data:image\/)/i.test(inner)) return "";
  return inner;
}

function findField(fields, id) {
  if (!Array.isArray(fields)) return null;
  return fields.find((f) => f?.id === id) || null;
}

export default function BannerThumb({
  banner,
  href,
  index = 0,
}) {
  const router = useRouter();
  const link = href || `/dashboard/banners/${banner.id}`;
  const isTopScore = banner.score != null && banner.score >= 80;
  const [imgFailed, setImgFailed] = useState(false);

  // Derive the visual signature of the banner once per row. Memoized
  // because hoover/scroll re-renders shouldn't redo string parsing on
  // every banner — with 100 thumbs in the gallery that adds up.
  const visual = useMemo(() => {
    const bgField     = findField(banner.fields, "bg");
    const fgField     = findField(banner.fields, "fg");
    const accentField = findField(banner.fields, "accent");
    const bgImageField = findField(banner.fields, "bg_image");
    // Field value wins over the row column because users can edit fields
    // post-generation; the column was set at insert time and goes stale.
    const fieldImage  = bgImageField ? unwrapUrl(bgImageField.value) : "";
    const rowImage    = unwrapUrl(banner.imageUrl);
    const photoUrl    = fieldImage || rowImage || "";

    const baseBg = bgField?.value || banner.gradient || "#0c0c10";
    return {
      photoUrl,
      baseBg,
      fgColor:     fgField?.value || "#ffffff",
      accentColor: accentField?.value || "#a78bfa",
    };
  }, [banner.fields, banner.imageUrl, banner.gradient]);

  // Hover/focus prefetch — seeds the detail page's cache with the full
  // row we already have on the list (saves the round-trip), and warms
  // the Next.js route bundle. Detail navigation feels instant.
  const prefetch = () => {
    const cached = getCached(["banner", banner.id, banner.user_id]);
    if (!cached) {
      try {
        setCached(["banner", banner.id, banner.user_id], banner, {
          ttlMs: 5 * 60_000,
          tags: ["banners", `banner:${banner.id}`],
        });
      } catch { /* quota — ignore */ }
    }
    try { router.prefetch?.(link); } catch { /* best-effort */ }
  };

  // Decide which background visual to render. A photo URL wins because
  // it's the strongest identifier; otherwise we render a coloured panel
  // built from the banner's own palette so the card still feels like a
  // miniature of the real thing.
  const showPhoto = !!visual.photoUrl && !imgFailed;
  const panelStyle = !showPhoto
    ? {
        background: `linear-gradient(135deg, ${visual.baseBg} 0%, color-mix(in oklab, ${visual.baseBg} 70%, ${visual.accentColor}) 100%)`,
      }
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.35,
        delay: Math.min(index, 6) * 0.03,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
    >
      <Link
        href={link}
        prefetch
        onMouseEnter={prefetch}
        onFocus={prefetch}
        className="group block overflow-hidden rounded-2xl border border-border/70 bg-surface-2 shadow-[0_18px_60px_-46px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_28px_80px_-48px_rgba(0,0,0,0.7)]"
      >
        <div
          className={cn(
            aspectClass(banner.aspect),
            "relative overflow-hidden bg-surface-2",
          )}
          style={panelStyle}
        >
          {showPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={visual.photoUrl}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
              className="absolute inset-0 h-full w-full object-cover"
              // The bg layer renders at ~60% brightness in the real
              // banner; matching that here means the card matches the
              // real preview the user will see when they open the
              // detail page.
              style={{ filter: "brightness(0.62)" }}
            />
          )}

          {/* Accent tint stripe on the left edge — a tiny, cheap visual
              that hints at the banner's accent colour without rendering
              the whole template. */}
          <span
            className="absolute left-0 top-0 h-full w-0.75"
            style={{
              background: `linear-gradient(to bottom, transparent, ${visual.accentColor} 25%, ${visual.accentColor} 75%, transparent)`,
              opacity: 0.7,
            }}
          />

          {/* Bottom readability gradient so the title pops on any bg */}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/65 via-black/25 to-transparent" />

          {banner.favourite && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[10px] font-medium text-amber-300 backdrop-blur">
              <Star className="h-2.5 w-2.5" fill="currentColor" strokeWidth={0} />
              Favourite
            </span>
          )}

          {banner.score != null && (
            <span
              className={cn(
                "absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] backdrop-blur",
                isTopScore
                  ? "border border-emerald-400/25 bg-emerald-400/15 text-emerald-100"
                  : "border border-amber-400/25 bg-amber-400/15 text-amber-100",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isTopScore ? "bg-emerald-400" : "bg-amber-400",
                )}
              />
              {banner.score}
            </span>
          )}

          {/* Title block. White text over the readability gradient — the
              same hierarchy the real banner uses, so the thumb reads as
              a clean miniature of the full design. */}
          <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="line-clamp-2 text-sm font-semibold leading-snug text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                {banner.title}
              </div>
              <div className="mt-1 truncate text-[10px] uppercase tracking-[0.14em] text-white/65">
                {banner.modelLabel || "—"} · {banner.style || "—"}
              </div>
            </div>
            <div className="shrink-0 rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/70 backdrop-blur">
              {banner.createdAt ? fmtDate(banner.createdAt) : "New"}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
