// src/app/admin/page.js
"use client";

import Link from "next/link";
import { Activity, BarChart3, Cpu, Image as ImageIcon, Users } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import StatCard from "@/components/dashboard/StatCard";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import Skeleton from "@/components/ui/Skeleton";
import EmptyData from "@/components/ui/EmptyData";
import AreaActivity from "@/components/admin/AreaActivity";
import ModelShareChart from "@/components/admin/ModelShareChart";
import { useApiCache } from "@/lib/useApiCache";

const LATEST_PAGE_SIZE = 8;

export default function AdminOverview() {
  const { user } = useAuth();
  
  // Cached for 5 min — invalidated by the banners/generation_results
  // mutation tags. The recent-banners section embeds rendered template
  // payloads, so we keep this in-memory only (persist:false) instead
  // of trying to mirror it into sessionStorage.
  const { data: apiData, isLoading } = useApiCache(
    `/api/admin/overview?page=1&pageSize=${LATEST_PAGE_SIZE}`,
    { ttlMs: 5 * 60_000, tags: ["banners", "generation_results"], enabled: !!user, persist: false },
  );

  const kpis = apiData?.kpis || null;
  const activity = apiData?.activity || null;
  const share = apiData?.share || null;
  const recent = apiData?.recent?.rows || [];

  const cards = kpis && [
    { id: "users", label: "Users", value: kpis.users, icon: <Users className="h-4 w-4" /> },
    { id: "banners", label: "Banners saved", value: kpis.banners, icon: <ImageIcon className="h-4 w-4" /> },
    { id: "score", label: "Avg quality score", value: kpis.avgScore ?? "—", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "latency", label: "P50 latency", value: kpis.p50ms ? `${(kpis.p50ms / 1000).toFixed(2)}s` : "—", icon: <Activity className="h-4 w-4" /> },
  ];

  const totalGenerations = activity?.reduce((s, d) => s + d.generations, 0) ?? 0;

  return (
    <>
      <TopBar title="Admin overview" action={null} />
      <div className="mx-auto w-full max-w-7xl space-y-8 px-5 py-8 md:px-8 md:py-10">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Platform pulse</h1>
          <p className="mt-1 text-sm text-muted">Last 14 days of generation activity.</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : cards ? (
            cards.map((c, i) => <StatCard key={c.id} {...c} delay={i * 0.05} />)
          ) : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card elevated className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Generations · last 14 days</h3>
                <p className="text-[11px] text-muted">Daily totals across the platform.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] px-2.5 py-1 text-[11px] text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Total · {totalGenerations.toLocaleString()}
              </span>
            </div>
            <div className="mt-4">
              {isLoading ? <Skeleton className="h-64" /> : activity ? <AreaActivity data={activity} /> : <Skeleton className="h-64" />}
            </div>
          </Card>

          <Card elevated className="p-5">
            <h3 className="text-sm font-semibold tracking-tight">Model share</h3>
            <p className="text-[11px] text-muted">Runs per model.</p>
            <div className="mt-4">
              {isLoading ? (
                <Skeleton className="h-64" />
              ) : share && share.length ? (
                <ModelShareChart data={share} />
              ) : share ? (
                <EmptyData title="No runs yet" body="Model share appears once users generate." />
              ) : (
                <Skeleton className="h-64" />
              )}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card elevated className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">Top models</h3>
              <Link href="/admin/models" className="text-[11px] text-muted hover:text-foreground transition-colors">
                See all
              </Link>
            </div>
            {share && share.length ? (
              <ul className="mt-4 divide-y divide-border">
                {share.slice(0, 6).map((m) => (
                  <li key={m.id} className="grid grid-cols-[1.5fr_repeat(3,1fr)] items-center gap-3 py-3 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-muted-strong">
                        <Cpu className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-foreground">{m.label}</div>
                        <div className="truncate text-[11px] text-muted">{m.id}</div>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-mono text-foreground">{m.runs.toLocaleString()}</div>
                      <div className="text-[10px] text-muted">runs</div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-mono text-foreground">{m.avgScore ?? "—"}</div>
                      <div className="text-[10px] text-muted">avg score</div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-mono text-foreground">
                        {m.p50ms ? `${(m.p50ms / 1000).toFixed(2)}s` : "—"}
                      </div>
                      <div className="text-[10px] text-muted">p50</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : share ? (
              <EmptyData className="mt-4" title="No data yet" body="Numbers appear after the first generation." />
            ) : (
              <div className="mt-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            )}
          </Card>

          <Card elevated className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">Latest banners</h3>
              <Link href="/admin/outputs" className="text-[11px] text-muted hover:text-foreground transition-colors">
                See all
              </Link>
            </div>
            {recent ? (
              <>
                {recent.length ? (
                  <ul className="mt-4 space-y-3">
                    {recent.map((o) => (
                      <li key={o.id} className="flex items-center gap-3">
                        <div
                          className="h-10 w-16 shrink-0 rounded-md ring-1 ring-inset ring-border"
                          style={{ background: o.preview_gradient || undefined }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-foreground">{o.title}</div>
                          <div className="flex items-center gap-1.5 truncate text-[11px] text-muted">
                            <Avatar name={o.profiles?.name || ""} size={14} className="text-[8px]!" />
                            <span className="truncate">{o.profiles?.name || o.profiles?.email || "—"}</span>
                          </div>
                        </div>
                        {o.score != null && (
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                              o.score >= 80
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-amber-500/10 text-amber-400"
                            }`}
                          >
                            {o.score}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyData className="mt-4" title="Quiet so far" body="Saved banners appear here." />
                )}
              </>
            ) : (
              <div className="mt-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
