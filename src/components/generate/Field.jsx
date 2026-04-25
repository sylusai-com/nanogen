import { cn } from "@/lib/cn";

export default function Field({ label, hint, children, className }) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-xs font-medium uppercase tracking-[0.1em] text-muted">
          {label}
        </label>
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
