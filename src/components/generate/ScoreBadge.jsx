import { cn } from "@/lib/cn";
import { SCORE_THRESHOLD } from "@/lib/models";

export default function ScoreBadge({ score, size = "sm" }) {
  const passed = score >= SCORE_THRESHOLD;
  const sizeCls = size === "lg" ? "text-sm px-2.5 py-1" : "text-[11px] px-2 py-0.5";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-mono ring-1 ring-inset",
        passed
          ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30"
          : "bg-amber-500/10 text-amber-400 ring-amber-500/30",
        sizeCls,
      )}
      title={`Quality score${passed ? " — passed threshold" : " — below threshold"}`}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          passed ? "bg-emerald-400" : "bg-amber-400",
        )}
      />
      {score}
    </span>
  );
}
