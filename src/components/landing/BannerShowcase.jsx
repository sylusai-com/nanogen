"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Section from "@/components/ui/Section";
import Badge from "@/components/ui/Badge";

// Banner items — images from /public/banners/, with gradient fallbacks.
// aspect: "wide" = 16:9, "square" = 1:1
const banners = [
  {
    src: "/banners/banner-1.png",
    title: "Product Launch Hero",
    tag: "Launch",
    aspect: "wide",
    description: "Full-bleed hero banner with bold typography and dynamic gradients",
    gradient: "linear-gradient(135deg, #08111f 0%, #13365f 45%, #0f766e 100%)",
  },
  {
    src: "/banners/banner-2.png",
    title: "Editorial Campaign",
    tag: "Editorial",
    aspect: "wide",
    description: "Magazine-quality layout with premium typography and layered elements",
    gradient: "linear-gradient(135deg, #0f172a 0%, #312e81 48%, #7c3aed 100%)",
  },
  {
    src: "/banners/banner-3.png",
    title: "Social Media Ad",
    tag: "Social",
    aspect: "square",
    description: "Eye-catching social creative optimized for engagement",
    gradient: "linear-gradient(135deg, #3f1d6f 0%, #9f1239 50%, #f97316 100%)",
  },
  {
    src: "/banners/banner-4.png",
    title: "App Store Feature",
    tag: "Spotlight",
    aspect: "square",
    description: "Clean app showcase banner with floating UI elements",
    gradient: "linear-gradient(135deg, #10172a 0%, #1f2937 48%, #334155 100%)",
  },
  {
    src: "/banners/banner-5.png",
    title: "E-commerce Promo",
    tag: "Commerce",
    aspect: "square",
    description: "Conversion-focused promotional banner with strong CTA",
    gradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 48%, #0f3460 100%)",
  },
];

/* ── helpers ──────────────────────────────────────────────────────── */

function BannerImage({ banner, idx, imgErrors, onError, className = "" }) {
  if (imgErrors[idx]) {
    return (
      <div className={`absolute inset-0 ${className}`} style={{ background: banner.gradient }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_40%)]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(circle,black_40%,transparent_80%)]" />
      </div>
    );
  }
  return (
    <Image
      src={banner.src}
      alt={banner.title}
      fill
      className={`object-cover ${className}`}
      onError={() => onError(idx)}
      sizes="(max-width: 1024px) 100vw, 66vw"
    />
  );
}

function Overlay({ banner, size = "lg" }) {
  const isLg = size === "lg";
  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className={`absolute bottom-0 left-0 right-0 ${isLg ? "p-6 md:p-8" : "p-3 md:p-4"}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <Badge tone="primary" dot>{banner.tag}</Badge>
          <span className={`rounded-full border border-white/20 bg-white/10 px-2 py-0.5 uppercase tracking-[0.14em] text-white/80 backdrop-blur-sm ${isLg ? "text-[10px]" : "text-[9px]"}`}>
            {banner.aspect === "wide" ? "16 : 9" : "1 : 1"}
          </span>
        </div>
        <h3 className={`font-semibold text-white ${isLg ? "text-xl md:text-2xl" : "text-sm"}`}>
          {banner.title}
        </h3>
        {isLg && (
          <p className="mt-1.5 max-w-md text-sm text-white/60 hidden md:block">
            {banner.description}
          </p>
        )}
      </div>
    </>
  );
}

/* ── component ───────────────────────────────────────────────────── */

export default function BannerShowcase() {
  const [active, setActive] = useState(0);
  const [imgErrors, setImgErrors] = useState({});

  const next = useCallback(() => setActive((i) => (i + 1) % banners.length), []);
  const prev = useCallback(() => setActive((i) => (i - 1 + banners.length) % banners.length), []);

  // Auto-advance every 6 seconds
  useEffect(() => {
    const id = setInterval(next, 6000);
    return () => clearInterval(id);
  }, [next]);

  const handleImgError = (idx) =>
    setImgErrors((p) => ({ ...p, [idx]: true }));

  const current = banners[active];
  const isWide = current.aspect === "wide";

  // Pick two side-panel banners (exclude active)
  const others = banners.map((b, i) => ({ b, idx: i })).filter((item) => item.idx !== active);
  
  // Prefer square banners on the side if main is wide, and wide banners if main is square
  const preferredSideAspect = isWide ? "square" : "wide";
  others.sort((a, b) => {
    if (a.b.aspect === preferredSideAspect && b.b.aspect !== preferredSideAspect) return -1;
    if (a.b.aspect !== preferredSideAspect && b.b.aspect === preferredSideAspect) return 1;
    return 0;
  });

  const sideA = others[0];
  const sideB = others[1];

  return (
    <Section
      id="banner-showcase"
      eyebrow="Generated banners"
      title="Stunning banners, generated in seconds"
      description="Real outputs from the Nanogen pipeline — every one scored, ranked, and ready to ship. Wide 16:9 hero banners and square 1:1 social creatives."
    >
      {/* ── Adaptive Layout ────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Main featured banner */}
        <div 
          className={`relative w-full transition-all duration-500 ease-[cubic-bezier(0.21,0.47,0.32,0.98)] ${
            isWide ? "lg:w-[66%]" : "lg:w-[45%]"
          }`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, scale: 1.01 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.45, ease: [0.21, 0.47, 0.32, 0.98] }}
              className={`relative overflow-hidden rounded-2xl border border-border bg-surface w-full ${
                isWide ? "aspect-[16/9]" : "aspect-square"
              }`}
            >
              <BannerImage
                banner={current}
                idx={active}
                imgErrors={imgErrors}
                onError={handleImgError}
              />
              <Overlay banner={current} size="lg" />
            </motion.div>
          </AnimatePresence>

          {/* Navigation arrows */}
          <button
            type="button"
            onClick={prev}
            aria-label="Previous banner"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next banner"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Side panel — two stacked banners */}
        <div className="flex flex-col gap-3 w-full flex-1">
          {[{ b: sideA.b, idx: sideA.idx }, { b: sideB.b, idx: sideB.idx }].map(
            ({ b, idx }) => (
              <button
                key={b.title}
                type="button"
                onClick={() => setActive(idx)}
                className={`group relative flex-1 w-full overflow-hidden rounded-2xl border border-border bg-surface text-left transition-all hover:border-border-strong hover:ring-1 hover:ring-primary/20 ${
                  b.aspect === "square" ? "aspect-square" : "aspect-[16/9]"
                } lg:aspect-auto`}
              >
                <BannerImage
                  banner={b}
                  idx={idx}
                  imgErrors={imgErrors}
                  onError={handleImgError}
                />
                <Overlay banner={b} size="sm" />
              </button>
            ),
          )}
        </div>
      </div>

      {/* ── Thumbnail strip ───────────────────────────────────── */}
      <div className="mt-5 flex items-center gap-3 overflow-x-auto pb-1">
        {banners.map((b, i) => (
          <button
            key={b.title}
            type="button"
            onClick={() => setActive(i)}
            className={`group relative shrink-0 overflow-hidden rounded-xl border transition-all duration-200 ${
              i === active
                ? "border-primary ring-2 ring-primary/30 scale-[1.03]"
                : "border-border hover:border-border-strong opacity-50 hover:opacity-100"
            }`}
            style={{ width: b.aspect === "square" ? "80px" : "130px" }}
          >
            <div
              className={`relative w-full overflow-hidden ${
                b.aspect === "square" ? "aspect-square" : "aspect-[16/9]"
              }`}
            >
              {imgErrors[i] ? (
                <div className="h-full w-full" style={{ background: b.gradient }} />
              ) : (
                <Image
                  src={b.src}
                  alt={b.title}
                  fill
                  className="object-cover"
                  sizes="130px"
                  onError={() => handleImgError(i)}
                />
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1">
              <span className="text-[9px] font-medium text-white truncate block">
                {b.title}
              </span>
              <span className="text-[8px] text-white/50">
                {b.aspect === "wide" ? "16:9" : "1:1"}
              </span>
            </div>
          </button>
        ))}

        {/* Dots */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {banners.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Go to banner ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active
                  ? "w-5 bg-primary"
                  : "w-1.5 bg-muted/40 hover:bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}

