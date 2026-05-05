// src/components/generate/GenerationProgress.jsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";

// Lightweight loading screen for the banner studio. The internal pipeline
// (multi-model fan-out, scoring, persistence, etc.) is intentionally
// hidden from the user — they see a clean "we're working on it" view
// and a smooth progress bar.

function aspectClass(a) {
  if (a === "1:1")  return "aspect-square";
  if (a === "4:5")  return "aspect-[4/5]";
  if (a === "9:16") return "aspect-[9/16]";
  return "aspect-[16/9]";
}

// Faked progress that never overshoots and waits at the ceiling for the
// real model response.
//
//   - During the request: the bar eases toward `holdAt` (90 by default)
//     and parks there. It never exceeds 90 — slow late-stage models will
//     just wait at 90% rather than wrap around past 100.
//   - When `done` flips true (the API has returned and the parent is
//     redirecting), the bar smoothly animates from wherever it is up to
//     100 so the user sees a satisfying finish before the route changes.
function useFakeProgress({ expectedMs = 30000, holdAt = 90, done = false } = {}) {
  const [pct, setPct] = useState(2);

  useEffect(() => {
    if (done) {
      // Animate to 100 quickly. Slightly faster than the in-progress
      // tick so the finish feels deliberate, not stalled.
      const id = setInterval(() => {
        setPct((p) => {
          if (p >= 100) {
            clearInterval(id);
            return 100;
          }
          return Math.min(100, p + 4);
        });
      }, 30);
      return () => clearInterval(id);
    }

    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      // Quadratic ease-out toward holdAt: fast at the start, slowing as
      // we approach the ceiling so the bar never feels stuck early.
      const t      = Math.min(1, elapsed / expectedMs);
      const target = holdAt * (1 - Math.pow(1 - t, 2));
      setPct((p) => {
        if (p >= holdAt) return holdAt;
        // Always trend toward target, but don't decrease and don't exceed
        // the ceiling. The 0.4 floor keeps the bar moving even if target
        // hasn't grown past p yet (early ticks).
        const next = Math.max(target, p + 0.4);
        return Math.min(holdAt, next);
      });
    }, 200);
    return () => clearInterval(id);
  }, [expectedMs, holdAt, done]);

  return pct;
}

export default function GenerationProgress({ aspect = "16:9", done = false }) {
  const [elapsed, setElapsed] = useState(0);
  const pct = useFakeProgress({ expectedMs: 35000, holdAt: 90, done });

  useEffect(() => {
    const start = Date.now();
    const tick  = setInterval(
      () => setElapsed(Math.round((Date.now() - start) / 1000)),
      250,
    );
    return () => clearInterval(tick);
  }, []);

  // Progress is rounded for display, but always clamped to [0, 100].
  const display = Math.min(100, Math.max(0, Math.round(pct)));

  return (
    <div className="space-y-6">
      <Card elevated className="overflow-hidden p-0">
        <div className="relative">
          <div className={`${aspectClass(aspect)} relative w-full overflow-hidden bg-surface-2`}>
            <motion.div
              className="absolute inset-0"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
              style={{
                background:
                  "linear-gradient(90deg, transparent, color-mix(in oklab, var(--foreground) 8%, transparent), transparent)",
              }}
            />
            <div className="absolute inset-0 flex flex-col items-start justify-end gap-3 p-6 md:p-10">
              <div className="h-3 w-24 rounded-full bg-foreground/10" />
              <div className="h-10 w-3/4 rounded-md bg-foreground/15" />
              <div className="h-10 w-1/2 rounded-md bg-foreground/15" />
              <div className="h-3 w-2/3 rounded-full bg-foreground/8" />
              <div className="h-3 w-1/3 rounded-full bg-foreground/8" />
              <div className="mt-2 flex gap-2">
                <div className="h-9 w-32 rounded-full bg-foreground/15" />
                <div className="h-9 w-24 rounded-full bg-foreground/8" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border bg-surface-2 px-4 py-3 text-xs text-muted">
            <div className="inline-flex items-center gap-2">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              {done ? "Almost there…" : "Generating your banner…"}
            </div>
            <span className="font-mono text-[10px] text-muted-strong">{elapsed}s</span>
          </div>
        </div>
      </Card>

      <Card elevated className="p-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-semibold tracking-tight">Generating your banner</h3>
        </div>
        <p className="mt-3 text-xs text-muted">
          {done
            ? "Banner ready — opening the editor."
            : "Hang tight — we’ll drop you into the editor as soon as it’s ready."}
        </p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
            style={{ width: `${display}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
          <span>{display}%</span>
          <span className="font-mono text-[10px] text-muted-strong">{elapsed}s</span>
        </div>
      </Card>
    </div>
  );
}
