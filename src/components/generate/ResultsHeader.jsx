import { CheckCircle2 } from "lucide-react";
import { SCORE_THRESHOLD } from "@/lib/models";

export default function ResultsHeader({ total, passed, winner }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">Results</h3>
        <p className="text-xs text-muted">
          {passed} of {total} passed quality threshold (≥ {SCORE_THRESHOLD})
        </p>
      </div>
      {winner && (
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {winner.modelLabel} selected · {winner.score}
        </div>
      )}
    </div>
  );
}
