// src/app/admin/api/page.js
"use client";

import Link from "next/link";
import {
  Key,
  Activity,
  BarChart3,
  Clock,
  Users,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import StatCard from "@/components/dashboard/StatCard";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import EmptyData from "@/components/ui/EmptyData";
import Avatar from "@/components/ui/Avatar";
import ApiUsageChart from "@/components/dashboard/ApiUsageChart";
import { useApiCache } from "@/lib/useApiCache";

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  if (diffMs < 60_000) return "Just now";
  if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86400_000) return `${Math.floor(diffMs / 3600_000)}h ago`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminApiOverview() {
  const { user } = useAuth();

  const { data, isLoading } = useApiCache("/api/admin/api-overview", {
    ttlMs: 60_000,
    tags: ["api-usage"],
    enabled: !!user,
    persist: false,
  });

  const kpis = data
    ? [
        {
          id: "total-keys",
          label: "Total API keys",
          value: data.totalKeys,
          icon: <Key className="h-4 w-4" />,
        },
        {
          id: "active-keys",
          label: "Active keys",
          value: data.activeKeys,
          icon: <CheckCircle2 className="h-4 w-4" />,
        },
        {
          id: "today-requests",
          label: "Requests today",
          value: data.todayRequests?.toLocaleString(),
          icon: <Activity className="h-4 w-4" />,
        },
        {
          id: "total-requests",
          label: "Total requests",
          value: data.totalRequests?.toLocaleString(),
          icon: <BarChart3 className="h-4 w-4" />,
        },
      ]
    : null;

  return (
    <>
      <TopBar title="API Usage" action={null} />

      <div className="mx-auto w-full max-w-7xl space-y-8 px-5 py-8 md:px-8 md:py-10">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            API Overview
          </h1>
          <p className="mt-1 text-sm text-muted">
            Platform-wide API key and usage monitoring.
          </p>
        </header>

        {/* KPI cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))
            : kpis
            ? kpis.map((c, i) => (
                <StatCard key={c.id} {...c} delay={i * 0.05} />
              ))
            : null}
        </section>

        {/* Usage chart + Top users */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Card elevated className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">
                  API Requests · last 14 days
                </h3>
                <p className="text-[11px] text-muted">
                  Daily request volume across all keys.
                </p>
              </div>
              {data?.todayRequests != null && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] px-2.5 py-1 text-[11px] text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Today · {data.todayRequests.toLocaleString()}
                </span>
              )}
            </div>
            <div className="mt-4">
              {isLoading ? (
                <Skeleton className="h-64" />
              ) : (
                <ApiUsageChart data={data?.daily || []} />
              )}
            </div>
          </Card>

          <Card elevated className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">
                Top API users
              </h3>
              <Link
                href="/admin/users"
                className="text-[11px] text-muted hover:text-foreground transition-colors"
              >
                See all
              </Link>
            </div>
            {data?.topUsers?.length ? (
              <ul className="mt-4 divide-y divide-border">
                {data.topUsers.slice(0, 8).map((u) => (
                  <li
                    key={u.userId}
                    className="flex items-center gap-3 py-2.5 text-sm"
                  >
                    <Avatar name={u.name || u.email} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-foreground">
                        {u.name || u.email || "Unknown"}
                      </div>
                      {u.name && (
                        <div className="truncate text-[10px] text-muted">
                          {u.email}
                        </div>
                      )}
                    </div>
                    <span className="font-mono text-xs text-foreground">
                      {u.requests.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : data ? (
              <EmptyData
                className="mt-4"
                title="No API usage"
                body="Data appears after users make API requests."
              />
            ) : (
              <div className="mt-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            )}
          </Card>
        </section>

        {/* Recent API requests */}
        <section>
          <Card elevated className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">
                  Recent API requests
                </h3>
                <p className="text-[11px] text-muted">
                  Last 20 requests across the platform.
                </p>
              </div>
            </div>

            {data?.recentRequests?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 pr-4 font-medium text-muted">
                        Time
                      </th>
                      <th className="pb-2 pr-4 font-medium text-muted">
                        User
                      </th>
                      <th className="pb-2 pr-4 font-medium text-muted">
                        Model
                      </th>
                      <th className="pb-2 pr-4 font-medium text-muted">
                        Endpoint
                      </th>
                      <th className="pb-2 pr-4 font-medium text-muted text-right">
                        Status
                      </th>
                      <th className="pb-2 font-medium text-muted text-right">
                        Latency
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.recentRequests.map((r) => (
                      <tr key={r.id} className="text-foreground">
                        <td className="py-2.5 pr-4 text-muted whitespace-nowrap">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <Avatar
                              name={
                                r.profiles?.name || r.profiles?.email || ""
                              }
                              size={20}
                              className="text-[8px]!"
                            />
                            <span className="truncate max-w-[120px]">
                              {r.profiles?.name || r.profiles?.email || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px]">
                            {r.model_slug || "—"}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-[10px] text-muted">
                          {r.endpoint}
                        </td>
                        <td className="py-2.5 pr-4 text-right">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono ${
                              r.status_code >= 200 && r.status_code < 300
                                ? "bg-emerald-500/10 text-emerald-400"
                                : r.status_code === 429
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {r.status_code}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-mono text-muted">
                          {r.latency_ms ? `${r.latency_ms}ms` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : data ? (
              <EmptyData
                title="No API requests yet"
                body="Requests will appear here after users make API calls."
              />
            ) : (
              <div className="space-y-2">
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
