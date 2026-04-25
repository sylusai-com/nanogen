"use client";

import { Cpu, Power } from "lucide-react";
import TopBar from "@/components/dashboard/TopBar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { modelMetrics } from "@/lib/mockData";

function bar(percent, color) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, percent)}%`, background: color }}
      />
    </div>
  );
}

export default function AdminModels() {
  const models = modelMetrics();

  return (
    <>
      <TopBar title="Models" action={null} />
      <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <header>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Model performance</h1>
          <p className="mt-1 text-sm text-muted">Per-model run counts, quality, latency, and reliability.</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {models.map((m) => (
            <Card elevated key={m.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] text-primary ring-1 ring-inset ring-[color-mix(in_oklab,var(--primary)_25%,transparent)]">
                    <Cpu className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-base font-semibold tracking-tight">{m.label}</div>
                    <div className="text-[11px] text-muted">{m.provider}</div>
                  </div>
                </div>
                <Badge tone="success" dot>
                  Healthy
                </Badge>
              </div>

              <dl className="mt-5 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-muted">Runs</dt>
                  <dd className="mt-1 font-mono">{m.runs.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-muted">Avg score</dt>
                  <dd className="mt-1 font-mono">{m.avgScore}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-muted">P50</dt>
                  <dd className="mt-1 font-mono">{(m.p50ms / 1000).toFixed(2)}s</dd>
                </div>
              </dl>

              <div className="mt-5 space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
                    <span>Share of traffic</span>
                    <span className="font-mono">{(m.share * 100).toFixed(0)}%</span>
                  </div>
                  {bar(m.share * 100, "var(--primary)")}
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
                    <span>Success rate</span>
                    <span className="font-mono">{(m.success * 100).toFixed(1)}%</span>
                  </div>
                  {bar(m.success * 100, "#10b981")}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <span className="text-[11px] text-muted">Endpoint configured · auto-routed</span>
                <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] text-muted-strong hover:border-border-strong hover:text-foreground transition-colors">
                  <Power className="h-3 w-3" />
                  Disable
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
