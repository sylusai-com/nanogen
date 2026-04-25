import { cn } from "@/lib/cn";

export default function EmptyData({ icon, title, body, action, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-8 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-muted-strong ring-1 ring-inset ring-border">
          {icon}
        </span>
      )}
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
