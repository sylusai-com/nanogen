"use client";

import { motion } from "motion/react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

const previews = [
  {
    label: "Aurora Glass",
    score: 96,
    gradient:
      "linear-gradient(135deg, #08111f 0%, #13365f 45%, #0f766e 100%)",
    accent: "from-cyan-300/90 via-sky-400/80 to-emerald-300/80",
  },
  {
    label: "Editorial Signal",
    score: 92,
    selected: true,
    gradient:
      "linear-gradient(135deg, #0f172a 0%, #312e81 48%, #7c3aed 100%)",
    accent: "from-violet-300/90 via-fuchsia-300/80 to-cyan-200/80",
  },
  {
    label: "Electric Promo",
    score: 89,
    gradient:
      "linear-gradient(135deg, #3f1d6f 0%, #9f1239 48%, #f97316 100%)",
    accent: "from-pink-300/90 via-rose-300/80 to-amber-200/80",
  },
];

export default function HeroPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98], delay: 0.2 }}
      className="relative mx-auto mt-16 max-w-5xl"
    >
      <div className="surface-elevated relative overflow-hidden rounded-3xl p-1.5">
        <div className="rounded-[20px] bg-[linear-gradient(180deg,#0d0d10_0%,#0a0a0b_100%)] p-5 md:p-7">
          <div className="flex items-center justify-between gap-3 text-xs text-white/50">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-red-400/70" />
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-400/70" />
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400/70" />
            </div>
            <div className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 sm:flex">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="font-mono text-[10px]">nanogen.app / live banner</span>
            </div>
            <span className="font-mono text-[10px]">3 variations · 1 winner</span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="relative overflow-hidden rounded-[28px] border border-white/10"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.28),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(167,139,250,0.22),_transparent_30%),linear-gradient(135deg,#08111f_0%,#0f172a_45%,#111827_100%)]" />
              <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(circle_at_center,black_50%,transparent_92%)]" />
              <div className="relative flex min-h-[320px] flex-col justify-between p-6 md:min-h-[360px] md:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                    Launch banner
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/70">
                    16:9 hero
                  </span>
                </div>

                <div className="max-w-[24rem]">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
                    Aurora creative suite
                  </p>
                  <h3 className="mt-3 text-3xl font-semibold leading-[1.05] tracking-tight text-white md:text-4xl">
                    A modern banner with one clear message and a clean call to action.
                  </h3>
                  <p className="mt-4 max-w-[20rem] text-sm leading-relaxed text-white/70 md:text-[15px]">
                    Designed to feel premium on the homepage, sharp in a social crop, and
                    strong enough to carry a product launch.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/75">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    Soft-glow gradient
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    Editorial typography
                  </span>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-200">
                    Ready to export
                  </span>
                </div>

                <div className="absolute right-5 top-5 h-28 w-28 rounded-full bg-cyan-300/20 blur-2xl" />
                <div className="absolute bottom-8 right-10 h-36 w-36 rounded-full bg-violet-500/20 blur-3xl" />
              </div>
            </motion.div>

            <div className="grid gap-3">
              {previews.map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.24 + i * 0.1,
                    ease: [0.21, 0.47, 0.32, 0.98],
                  }}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border",
                    m.selected
                      ? "border-[var(--primary)]/60 ring-1 ring-[var(--primary)]/40"
                      : "border-white/10",
                  )}
                >
                  <div
                    className="aspect-[4/3] w-full"
                    style={{ background: m.gradient }}
                  >
                    <div
                      className={cn(
                        "h-full w-full bg-gradient-to-br opacity-75",
                        m.accent,
                      )}
                    />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.22),transparent_24%),radial-gradient(circle_at_75%_80%,rgba(255,255,255,0.12),transparent_28%)]" />
                  </div>
                  {m.selected && (
                    <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-fg">
                      <Check className="h-3 w-3" strokeWidth={3} />
                      Selected
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white/80">
                    <span className="truncate">{m.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-mono",
                        m.score >= 90
                          ? "bg-emerald-400/15 text-emerald-300"
                          : "bg-amber-400/15 text-amber-300",
                      )}
                    >
                      {m.score}
                    </span>
                  </div>
                </motion.div>
              ))}

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-xs text-white/65">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-white/45">Prompt</span>
                    <span className="text-white/85">
                      “Modern launch banner for a creative AI product, bold headline, clean CTA”
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Editorial Signal · 92
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Glow */}
      <div className="pointer-events-none absolute -inset-x-20 -bottom-16 h-48 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_40%,transparent),transparent)] blur-3xl" />
    </motion.div>
  );
}
