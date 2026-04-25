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

  const passed = results.filter((r) => r.score >= SCORE_THRESHOLD);
  const filtered = results.filter((r) => r.score < SCORE_THRESHOLD);
  const winner = passed.find((r) => r.id === winnerId);

  return (
    <div className="space-y-6">
      <ResultsHeader total={results.length} passed={passed.length} winner={winner} />

      <div className="grid gap-4 sm:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {passed.map((r, i) => (
            <BannerCard
              key={r.id}
              result={r}
              isWinner={r.id === winnerId}
              aspect={aspect}
              index={i}
            />
          ))}
        </AnimatePresence>
      </div>

      {filtered.length > 0 && (
        <details className="surface-card rounded-2xl p-4">
          <summary className="cursor-pointer text-xs text-muted hover:text-foreground transition-colors">
            Show {filtered.length} filtered output{filtered.length === 1 ? "" : "s"}
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {filtered.map((r, i) => (
              <BannerCard key={r.id} result={r} aspect={aspect} index={i} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
