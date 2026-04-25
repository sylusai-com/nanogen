import { cn } from "@/lib/cn";

export default function Eyebrow({ children, className, dot = true, tone = "neutral" }) {
  const toneCls =
    tone === "primary"
      ? "bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] text-primary border-[color-mix(in_oklab,var(--primary)_30%,transparent)]"
      : "bg-surface text-muted-strong border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium tracking-wide",
        toneCls,
        className,
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
      )}
      {children}
    </span>
  );
}
