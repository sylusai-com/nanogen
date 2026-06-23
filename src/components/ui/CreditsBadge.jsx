import { Coins, Infinity } from "lucide-react";
import { cn } from "@/lib/cn";

export default function CreditsBadge({ credits, className, compact = false }) {
  if (!credits) return null;

  const { remaining, total, is_admin } = credits;
  const isUnlimited = remaining === -1 || is_admin;
  
  const percentage = isUnlimited ? 100 : total > 0 ? (remaining / total) * 100 : 0;
  const isLow = !isUnlimited && remaining <= 2;
  const isOut = !isUnlimited && remaining === 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        isOut
          ? "border-red-500/30 bg-red-500/10 text-red-500"
          : isLow
          ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
          : "border-border-strong bg-surface-2 text-muted-strong hover:text-foreground",
        className
      )}
      title={isUnlimited ? "Unlimited credits" : `${remaining} credits remaining`}
    >
      <div className="relative flex items-center justify-center">
        <Coins className="h-3.5 w-3.5" />
      </div>
      {!compact && (
        <span>
          {isUnlimited ? (
            <span className="flex items-center gap-1">
              Unlimited
              <Infinity className="h-3 w-3" />
            </span>
          ) : (
            <span className="tabular-nums">
              {remaining} <span className="opacity-60">/ {total}</span>
            </span>
          )}
        </span>
      )}
    </div>
  );
}
