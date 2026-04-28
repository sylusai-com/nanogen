// src/components/builder/LayersPanel.jsx
"use client";

import {
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  MinusSquare,
  MousePointer2,
  Square,
  Type,
} from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS = {
  text:    Type,
  rect:    Square,
  button:  MousePointer2,
  image:   ImageIcon,
  divider: MinusSquare,
};

export default function LayersPanel({
  elements,
  selectedId,
  onSelect,
  onMoveUp,
  onMoveDown,
}) {
  if (elements.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[11px] text-muted">
        No elements yet.
        <br />Use the toolbar to add some.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {[...elements].reverse().map((el, reversedIdx) => {
        const realIdx = elements.length - 1 - reversedIdx;
        const Icon = ICONS[el.type] || Square;
        const isSelected = el.id === selectedId;

        return (
          <div
            key={el.id}
            onClick={() => onSelect(el.id)}
            className={cn(
              "flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors",
              isSelected
                ? "bg-primary/10 text-foreground"
                : "text-muted hover:bg-surface-2 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span className="flex-1 truncate capitalize">
              {el.type}
              {el.content ? (
                <span className="ml-1 text-muted/60">
                  ·{" "}
                  {String(el.content).slice(0, 16)}
                  {el.content.length > 16 ? "…" : ""}
                </span>
              ) : null}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                title="Move up (bring forward)"
                onClick={(e) => { e.stopPropagation(); onMoveUp(realIdx); }}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-surface text-muted hover:text-foreground transition-colors"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                title="Move down (send back)"
                onClick={(e) => { e.stopPropagation(); onMoveDown(realIdx); }}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-surface text-muted hover:text-foreground transition-colors"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}