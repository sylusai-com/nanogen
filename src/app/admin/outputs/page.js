"use client";

import { useMemo, useState } from "react";
import TopBar from "@/components/dashboard/TopBar";
import Avatar from "@/components/ui/Avatar";
import Tabs from "@/components/ui/Tabs";
import { recentOutputs } from "@/lib/mockData";
import { cn } from "@/lib/cn";

function aspectClass(a) {
  if (a === "1:1") return "aspect-square";
  if (a === "4:5") return "aspect-[4/5]";
  if (a === "9:16") return "aspect-[9/16]";
  return "aspect-[16/9]";
}

export default function AdminOutputs() {
  const all = recentOutputs(12);
  const [view, setView] = useState("all");

  const filtered = useMemo(() => {
    if (view === "passed") return all.filter((o) => o.score >= 80);
    if (view === "filtered") return all.filter((o) => o.score < 80);
    return all;
  }, [all, view]);

  return (
    <>
      <TopBar title="Outputs" action={null} />
      <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Recent outputs</h1>
            <p className="text-xs text-muted">Live feed of generations across the platform.</p>
          </div>
          <Tabs
            tabs={[
              { id: "all", label: `All · ${all.length}` },
              { id: "passed", label: `Passed · ${all.filter((o) => o.score >= 80).length}` },
              { id: "filtered", label: `Filtered · ${all.filter((o) => o.score < 80).length}` },
            ]}
            value={view}
            onChange={setView}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((o) => (
            <div
              key={o.id}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <div className={cn(aspectClass(o.aspect))} style={{ background: o.gradient }} />
              <div className="space-y-2 border-t border-border bg-surface-2 px-3 py-2.5">
                <div className="truncate text-sm text-foreground">{o.title}</div>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0 text-muted">
                    <Avatar name={o.user} size={16} className="!text-[8px]" />
                    <span className="truncate">{o.user}</span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono ${
                      o.score >= 80 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {o.score}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
