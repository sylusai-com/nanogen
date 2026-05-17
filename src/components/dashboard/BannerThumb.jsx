// src/components/dashboard/BannerThumb.jsx
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { setCached, getCached } from "@/lib/cache";
import BannerPreview from "@/components/banner/BannerPreview";

// Each tile renders the REAL banner via BannerPreview (an iframe) so the
// gallery shows what the user actually generated — title typography, bg
// photo, layout, decoration, everything. BannerPreview's `lazy` mode
// gates the iframe on an IntersectionObserver so only the handful of
// thumbs currently in the viewport (+ a 400px rootMargin) actually
// mount one; the rest stay as a coloured fallback panel until scrolled
// to. With CSS-columns masonry that translates to ~6-8 live iframes at
// any time on a typical 1080p screen, which is light enough to scroll
// smoothly even with 100+ banners in the accumulator.
//
// We still render a coloured fallback panel underneath the iframe so the
// tile has SOMETHING visible the moment it's rendered — useful while the
// iframe is mounting (a few hundred ms on cold load) and as a graceful
// degradation when html/css are missing (very old rows, partial fields).

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

  // Fallback panel colour from the banner's own palette so the tile
  // has the right vibe even before its iframe mounts.
  const visual = useMemo(() => {
    const bgField     = findField(banner.fields, "bg");
    const accentField = findField(banner.fields, "accent");
    const baseBg = bgField?.value || banner.gradient || "#0c0c10";
    return {
      baseBg,
      accentColor: accentField?.value || "#a78bfa",
    };
  }, [banner.fields, banner.gradient]);

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

  const hasTemplate = Boolean(banner.html && banner.css);
  const panelStyle = {
    background: `linear-gradient(135deg, ${visual.baseBg} 0%, color-mix(in oklab, ${visual.baseBg} 70%, ${visual.accentColor}) 100%)`,
  };

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
          {hasTemplate ? (
            <BannerPreview
              banner={banner}
              className="absolute inset-0 h-full w-full"
              lazy
              rootMargin="400px"
            />
          ) : null}

          {/* Accent tint stripe on the left edge — a tiny, cheap visual
              that hints at the banner's accent colour. Sits ABOVE the
              iframe so the tile still feels integrated with the gallery
              chrome even while the iframe paints. */}
          <span
            className="pointer-events-none absolute left-0 top-0 z-10 h-full w-0.75"
            style={{
              background: `linear-gradient(to bottom, transparent, ${visual.accentColor} 25%, ${visual.accentColor} 75%, transparent)`,
              opacity: 0.7,
            }}
          />

          {/* Bottom readability gradient so the title overlay pops on
              top of whatever the banner itself painted. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2/3 bg-gradient-to-t from-black/65 via-black/25 to-transparent" />

          {banner.favourite && (
            <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[10px] font-medium text-amber-300 backdrop-blur">
              <Star className="h-2.5 w-2.5" fill="currentColor" strokeWidth={0} />
              Favourite
            </span>
          )}

          {banner.score != null && (
            <span
              className={cn(
                "absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] backdrop-blur",
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

          {/* Title block — sits above the iframe and readability
              gradient so the user can scan the gallery by title even
              when the underlying banner art is busy. */}
          <div className="absolute inset-x-3 bottom-3 z-20 flex items-end justify-between gap-2">
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
