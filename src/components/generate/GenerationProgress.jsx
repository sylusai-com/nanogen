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

// Smooth fake-progress: eases toward 95% over the expected window so the
// bar never sits idle. The redirect happens as soon as the API returns,
// so we never need to reach 100% here.
function useFakeProgress({ expectedMs = 18000 } = {}) {
  const [pct, setPct] = useState(4);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const target  = Math.min(95, (elapsed / expectedMs) * 100);
      setPct((p) => (target > p ? target : p + 0.15));
    }, 200);
    return () => clearInterval(id);
  }, [expectedMs]);

  return pct;
}

export default function GenerationProgress({ aspect = "16:9" }) {
  const [elapsed, setElapsed] = useState(0);
  const pct = useFakeProgress({ expectedMs: 18000 });

  useEffect(() => {
    const start = Date.now();
    const tick  = setInterval(
      () => setElapsed(Math.round((Date.now() - start) / 1000)),
      250,
    );
    return () => clearInterval(tick);
  }, []);

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
              Generating your banner…
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
          Hang tight — we’ll drop you into the editor as soon as it’s ready.
        </p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
          <span>{Math.round(pct)}%</span>
          <span className="font-mono text-[10px] text-muted-strong">{elapsed}s</span>
        </div>
      </Card>
    </div>
  );
}
