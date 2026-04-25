"use client";

import { motion } from "motion/react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

const previews = [
  {
    label: "Stable Diffusion XL",
    score: 84,
    gradient:
      "linear-gradient(135deg, #4c1d95 0%, #1e1b4b 50%, #082f49 100%)",
    accent: "from-violet-400 to-purple-500",
  },
  {
    label: "Imagen 3",
    score: 91,
    selected: true,
    gradient:
      "linear-gradient(135deg, #1e1b4b 0%, #0c0a35 50%, #134e4a 100%)",
    accent: "from-cyan-300 to-violet-400",
  },
  {
    label: "Flux Pro",
    score: 76,
    gradient:
      "linear-gradient(135deg, #831843 0%, #1e1b4b 50%, #18181b 100%)",
    accent: "from-pink-400 to-amber-300",
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
          {/* Mock toolbar */}
          <div className="flex items-center justify-between text-xs text-white/50">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-red-400/70" />
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-400/70" />
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400/70" />
            </div>
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="font-mono text-[10px]">nanogen.app/generate</span>
            </div>
            <span className="font-mono text-[10px]">3 of 3 ready</span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {previews.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: 0.45 + i * 0.12,
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
                  <div className={cn("h-full w-full bg-gradient-to-br opacity-70", m.accent)} />
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
                      m.score >= 80
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-amber-400/15 text-amber-300",
                    )}
                  >
                    {m.score}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-5 flex flex-col items-start justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs text-white/60 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-white/50">Prompt</span>
              <span className="text-white/85">
                “Launch banner for a fintech app — soft gold accent on navy”
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Imagen 3 · 91
            </span>
          </div>
        </div>
      </div>

      {/* Glow */}
      <div className="pointer-events-none absolute -inset-x-20 -bottom-16 h-48 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_40%,transparent),transparent)] blur-3xl" />
    </motion.div>
  );
}
