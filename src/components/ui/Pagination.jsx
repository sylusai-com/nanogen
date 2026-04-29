"use client";

import Button from "@/components/ui/Button";
import { cn } from "@/lib/cn";

function windowedPages(page, totalPages) {
  const pages = [];
  const add = (value) => {
    if (!pages.includes(value)) pages.push(value);
  };

  add(1);
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) add(i);
  if (totalPages > 1) add(totalPages);

  return pages.sort((a, b) => a - b).reduce((acc, value, index, arr) => {
    acc.push(value);
    const next = arr[index + 1];
    if (next && next - value > 1) acc.push("...");
    return acc;
  }, []);
}

export default function Pagination({ page, totalPages, onPageChange, className }) {
  if (!totalPages || totalPages <= 1) return null;

  const pages = windowedPages(page, totalPages);

  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-surface-2/70 p-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="text-xs text-muted">
        Page <span className="font-mono text-foreground">{page}</span> of <span className="font-mono text-foreground">{totalPages}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        {pages.map((value, index) =>
          value === "..." ? (
            <span key={`ellipsis-${index}`} className="px-2 text-xs text-muted">
              …
            </span>
          ) : (
            <Button
              key={value}
              size="sm"
              variant={value === page ? "primary" : "secondary"}
              onClick={() => onPageChange(value)}
            >
              {value}
            </Button>
          ),
        )}
        <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}