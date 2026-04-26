"use client";

import { useEffect, useState } from "react";
import { Cpu, Power } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import { MODELS } from "@/lib/models";
import TopBar from "@/components/dashboard/TopBar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { getModelShare } from "@/lib/db/admin";

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
  const { user, supabase } = useAuth();
  const [share, setShare] = useState(null);

  useEffect(() => {
    if (!user) return;
    getModelShare(supabase)
      .then(setShare)
      .catch((e) => console.error("admin models", e));
  }, [user, supabase]);

  // Merge configured catalog with live metrics so disabled / never-used
  // models still appear with zeros.
  const merged = MODELS.map((cfg) => {
    const live = share?.find((s) => s.id === cfg.id);
    return {
      id: cfg.id,
      label: cfg.label,
      provider: cfg.provider,
      enabled: cfg.enabled,
      runs: live?.runs ?? 0,
      avgScore: live?.avgScore ?? null,
      p50ms: live?.p50ms ?? null,
      share: live?.share ?? 0,
    };
  });

  return (
    <>
      <TopBar title="Models" action={null} />
      <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <header>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Model performance</h1>
          <p className="mt-1 text-sm text-muted">
            Live aggregates from <code className="font-mono text-muted-strong">generation_results</code>.
          </p>
        </header>

        {!share ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {merged.map((m) => (
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
                  <Badge tone={m.enabled ? "success" : "neutral"} dot>
                    {m.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                <dl className="mt-5 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-muted">Runs</dt>
                    <dd className="mt-1 font-mono">{m.runs.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-muted">Avg score</dt>
                    <dd className="mt-1 font-mono">{m.avgScore ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-muted">P50</dt>
                    <dd className="mt-1 font-mono">
                      {m.p50ms ? `${(m.p50ms / 1000).toFixed(2)}s` : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
                    <span>Share of traffic</span>
                    <span className="font-mono">{(m.share * 100).toFixed(0)}%</span>
                  </div>
                  {bar(m.share * 100, "var(--primary)")}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-[11px] text-muted">
                    {m.enabled ? "Configured · auto-routed" : "Not currently routed"}
                  </span>
                  <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] text-muted-strong hover:border-border-strong hover:text-foreground transition-colors">
                    <Power className="h-3 w-3" />
                    {m.enabled ? "Disable" : "Enable"}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
