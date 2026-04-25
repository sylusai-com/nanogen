import { cn } from "@/lib/cn";

const TONES = {
  neutral: "bg-surface text-muted-strong border border-border",
  primary: "bg-[color-mix(in_oklab,var(--primary)_15%,transparent)] text-primary border border-[color-mix(in_oklab,var(--primary)_30%,transparent)]",
  success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  danger: "bg-red-500/10 text-red-400 border border-red-500/20",
};

export default function Badge({ tone = "neutral", className, children, dot = false }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none",
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "primary" && "bg-primary",
            tone === "success" && "bg-emerald-400",
            tone === "warning" && "bg-amber-400",
            tone === "danger" && "bg-red-400",
            tone === "neutral" && "bg-[var(--muted)]",
          )}
        />
      )}
      {children}
    </span>
  );
}
