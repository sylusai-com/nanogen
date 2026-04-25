import { cn } from "@/lib/cn";

export function Table({ children, className }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

export function THead({ children }) {
  return (
    <thead className="bg-surface-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
      {children}
    </thead>
  );
}

export function TR({ children, className, onClick }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-t border-border first:border-t-0",
        onClick && "cursor-pointer hover:bg-surface",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TH({ children, className, align = "left" }) {
  return (
    <th
      className={cn(
        "px-4 py-3 font-semibold",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({ children, className, align = "left" }) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}
