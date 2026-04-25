"use client";

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Label } from "@/components/ui/Input";

const OPTIONS = [
  { id: "left", icon: <AlignLeft className="h-3.5 w-3.5" /> },
  { id: "center", icon: <AlignCenter className="h-3.5 w-3.5" /> },
  { id: "right", icon: <AlignRight className="h-3.5 w-3.5" /> },
];

export default function AlignmentField({ value, onChange }) {
  return (
    <div className="space-y-2">
      <Label>Alignment</Label>
      <div className="inline-flex rounded-xl border border-border bg-background p-1">
        {OPTIONS.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={cn(
                "inline-flex h-8 w-10 items-center justify-center rounded-lg transition-colors",
                active ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground",
              )}
              aria-label={`Align ${o.id}`}
              aria-pressed={active}
            >
              {o.icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}
