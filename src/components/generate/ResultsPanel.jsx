// src/components/generate/ResultsPanel.jsx
"use client";

import { AnimatePresence } from "motion/react";
import { SCORE_THRESHOLD } from "@/lib/models";
import BannerCard from "./BannerCard";
import EmptyState from "./EmptyState";
import LoadingResults from "./LoadingResults";
import ResultsHeader from "./ResultsHeader";

export default function ResultsPanel({ status, results, winnerId, aspect }) {
  if (status === "idle") return <EmptyState />;
  if (status === "generating") return <LoadingResults aspect={aspect} />;

  const passed   = results.filter((r) => r.score >= SCORE_THRESHOLD);
  const filtered = results.filter((r) => r.score < SCORE_THRESHOLD);

  // Threshold + top-fallback selection: prefer passing variants; if none
  // passed, surface the absolute top scorer so users always see a result.
  const fallbackTop = !passed.length && results.length
    ? [...results].sort((a, b) => b.score - a.score)[0]
    : null;

  const display = passed.length ? passed : fallbackTop ? [fallbackTop] : [];
  const winner =
    passed.find((r) => r.id === winnerId) ||
    (fallbackTop && fallbackTop.id === winnerId ? fallbackTop : null) ||
    fallbackTop;

  const filteredRest = fallbackTop
    ? filtered.filter((r) => r.id !== fallbackTop.id)
    : filtered;

  return (
    <div className="space-y-6">
      <ResultsHeader total={results.length} passed={passed.length} winner={winner} />

      {fallbackTop && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          No variant reached the {SCORE_THRESHOLD}-point threshold — showing
          the top scorer ({fallbackTop.score}/100). Regenerate or refine the
          prompt for a stronger result.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {display.map((r, i) => (
            <BannerCard
              key={r.id}
              result={r}
              isWinner={winner ? r.id === winner.id : false}
              aspect={aspect}
              index={i}
            />
          ))}
        </AnimatePresence>
      </div>

      {filteredRest.length > 0 && (
        <details className="surface-card rounded-2xl p-4">
          <summary className="cursor-pointer text-xs text-muted hover:text-foreground transition-colors">
            Show {filteredRest.length} filtered output{filteredRest.length === 1 ? "" : "s"}
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {filteredRest.map((r, i) => (
              <BannerCard key={r.id} result={r} aspect={aspect} index={i} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
