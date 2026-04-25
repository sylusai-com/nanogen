import { cn } from "@/lib/cn";

export default function Card({
  children,
  className,
  elevated = false,
  interactive = false,
  as: As = "div",
}) {
  return (
    <As
      className={cn(
        "rounded-2xl",
        elevated ? "surface-elevated" : "surface-card",
        interactive &&
          "transition-all duration-200 hover:border-border-strong hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </As>
  );
}
