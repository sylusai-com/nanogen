"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";

function aspectClass(a) {
  if (a === "1:1") return "aspect-square";
  if (a === "4:5") return "aspect-[4/5]";
  if (a === "9:16") return "aspect-[9/16]";
  return "aspect-[16/9]";
}

export default function LoadingResults({ aspect = "16:9", count = 4 }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        Running models in parallel and scoring outputs…
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: count }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="overflow-hidden rounded-2xl border border-border"
          >
            <div className={cn(aspectClass(aspect), "skeleton")} />
            <div className="space-y-2 border-t border-border bg-surface-2 px-3 py-3">
              <div className="h-3 w-1/2 rounded skeleton" />
              <div className="h-2 w-1/3 rounded skeleton" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
