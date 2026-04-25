import { cn } from "@/lib/cn";

export default function IconBox({ children, size = "md", className, tone = "primary" }) {
  const sizeCls =
    size === "sm" ? "h-8 w-8 rounded-lg" : size === "lg" ? "h-12 w-12 rounded-xl" : "h-10 w-10 rounded-xl";
  const toneCls =
    tone === "primary"
      ? "bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-primary ring-1 ring-inset ring-[color-mix(in_oklab,var(--primary)_25%,transparent)]"
      : "bg-surface-2 text-foreground ring-1 ring-inset ring-[var(--border)]";
  return (
    <span className={cn("inline-flex items-center justify-center", sizeCls, toneCls, className)}>
      {children}
    </span>
  );
}
