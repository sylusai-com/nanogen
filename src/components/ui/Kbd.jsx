import { cn } from "@/lib/cn";

export default function Kbd({ children, className }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border bg-surface px-1.5 font-mono text-[10px] text-muted-strong",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
