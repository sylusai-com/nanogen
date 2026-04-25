"use client";

import { Activity, BarChart3, Cpu, Image as ImageIcon, Users } from "lucide-react";
import TopBar from "@/components/dashboard/TopBar";
import StatCard from "@/components/dashboard/StatCard";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import AreaActivity from "@/components/admin/AreaActivity";
import ModelShareChart from "@/components/admin/ModelShareChart";
import { adminKpis, dailyActivity, modelMetrics, recentOutputs } from "@/lib/mockData";
import Link from "next/link";

const ICONS = {
  users: <Users className="h-4 w-4" />,
  banners: <ImageIcon className="h-4 w-4" />,
  score: <BarChart3 className="h-4 w-4" />,
  latency: <Activity className="h-4 w-4" />,
};

export default function AdminOverview() {
  const kpis = adminKpis();
  const activity = dailyActivity();
  const models = modelMetrics();
  const outputs = recentOutputs(5);

  return (
    <>
      <TopBar title="Admin overview" action={null} />
      <div className="mx-auto w-full max-w-7xl space-y-8 px-5 py-8 md:px-8 md:py-10">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Platform pulse</h1>
          <p className="mt-1 text-sm text-muted">Last 14 days of generation activity.</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k, i) => (
            <StatCard
              key={k.id}
              label={k.label}
              value={k.value}
              delta={k.delta}
              positive={k.positive}
              icon={ICONS[k.id]}
              delay={i * 0.05}
            />
          ))}
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
                Total · {activity.reduce((s, d) => s + d.generations, 0).toLocaleString()}
              </span>
            </div>
            <div className="mt-4">
              <AreaActivity data={activity} />
            </div>
          </Card>

          <Card elevated className="p-5">
            <h3 className="text-sm font-semibold tracking-tight">Model share</h3>
            <p className="text-[11px] text-muted">Runs per model.</p>
            <div className="mt-4">
              <ModelShareChart data={models} />
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
            <ul className="mt-4 divide-y divide-border">
              {models.map((m) => (
                <li key={m.id} className="grid grid-cols-[1.5fr_repeat(3,1fr)] items-center gap-3 py-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-muted-strong">
                      <Cpu className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-foreground">{m.label}</div>
                      <div className="truncate text-[11px] text-muted">{m.provider}</div>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-mono text-foreground">{m.runs.toLocaleString()}</div>
                    <div className="text-[10px] text-muted">runs</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-mono text-foreground">{m.avgScore}</div>
                    <div className="text-[10px] text-muted">avg score</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-mono text-foreground">{(m.success * 100).toFixed(1)}%</div>
                    <div className="text-[10px] text-muted">success</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card elevated className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">Latest outputs</h3>
              <Link href="/admin/outputs" className="text-[11px] text-muted hover:text-foreground transition-colors">
                See all
              </Link>
            </div>
            <ul className="mt-4 space-y-3">
              {outputs.map((o) => (
                <li key={o.id} className="flex items-center gap-3">
                  <div
                    className="h-10 w-16 shrink-0 rounded-md ring-1 ring-inset ring-border"
                    style={{ background: o.gradient }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-foreground">{o.title}</div>
                    <div className="flex items-center gap-1.5 truncate text-[11px] text-muted">
                      <Avatar name={o.user} size={14} className="!text-[8px]" />
                      <span className="truncate">{o.user}</span>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                      o.score >= 80 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {o.score}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </div>
    </>
  );
}
