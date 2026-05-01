// src/app/dashboard/page.js
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Images, Sparkles, Trophy, Clock, ArrowRight, ImageIcon } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import StatCard from "@/components/dashboard/StatCard";
import BannerThumb from "@/components/dashboard/BannerThumb";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyData from "@/components/ui/EmptyData";
import Skeleton from "@/components/ui/Skeleton";
import Pagination from "@/components/ui/Pagination";

const iconCls = "h-4 w-4";
const RECENT_PAGE_SIZE = 8;

export default function DashboardOverview() {
  const { user } = useAuth();
  const [recent, setRecent] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentPage, setRecentPage] = useState(1);
  const [recentTotalPages, setRecentTotalPages] = useState(1);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/dashboard/stats?page=${recentPage}&pageSize=${RECENT_PAGE_SIZE}`);
        const json = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setRecent(json.banners.rows || []);
          setRecentTotalPages(json.banners.totalPages || 1);
          setStats(json.stats || null);
        } else {
          console.error("dashboard load", json.error || "unknown");
        }
      } catch (e) {
        console.error("dashboard load", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, recentPage]);

  const cards = [
    {
      label: "Banners created",
      value: stats?.total ?? "—",
      icon: <Images className={iconCls} />,
    },
    {
      label: "This month",
      value: stats?.thisMonth ?? "—",
      icon: <Sparkles className={iconCls} />,
    },
    {
      label: "Avg quality",
      value: stats?.avgScore ?? "—",
      icon: <Trophy className={iconCls} />,
    },
    {
      label: "Median time",
      value: stats?.p50ms ? `${(stats.p50ms / 1000).toFixed(1)}s` : "—",
      icon: <Clock className={iconCls} />,
    },
  ];

  return (
    <>
      <TopBar />
      <div className="mx-auto w-full max-w-7xl space-y-10 px-5 py-8 md:px-8 md:py-10">
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
            </h1>
            <p className="mt-1 text-sm text-muted">
              Pick up where you left off, or generate something new.
            </p>
          </div>
          <Button
            href="/dashboard/create"
            size="lg"
            leftIcon={<Sparkles className="h-4 w-4" strokeWidth={2.5} />}
          >
            New banner
          </Button>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((s, i) => (
            <StatCard key={s.label} {...s} delay={i * 0.05} />
          ))}
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Recent banners</h2>
              <p className="text-xs text-muted">Your latest generations.</p>
            </div>
            <Link
              href="/dashboard/banners"
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {recent === null ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video" />
              ))}
            </div>
          ) : recent.length ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {recent.map((b, i) => (
                  <BannerThumb key={b.id} banner={b} index={i} />
                ))}
              </div>
              <Pagination page={recentPage} totalPages={recentTotalPages} onPageChange={setRecentPage} />
            </div>
          ) : (
            <EmptyData
              icon={<ImageIcon className="h-5 w-5" />}
              title="No banners yet"
              body="Generate your first banner to see it here."
              action={
                <Button href="/dashboard/create" leftIcon={<Sparkles className="h-3.5 w-3.5" />}>
                  Create banner
                </Button>
              }
            />
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card elevated className="p-6 lg:col-span-2">
            <h3 className="text-sm font-semibold tracking-tight">Quick start</h3>
            <p className="mt-1 text-xs text-muted">
              Three ways to get a great banner in under a minute.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { title: "From a brief", body: "Paste a marketing brief and let Nanogen extract a prompt." },
                { title: "From a screenshot", body: "Drop in a reference and we'll match its style." },
                { title: "From a template", body: "Pick a starting point and tweak from there." },
              ].map((q) => (
                <Link
                  href="/dashboard/create"
                  key={q.title}
                  className="group rounded-xl border border-border bg-background p-4 transition-colors hover:border-border-strong hover:bg-surface"
                >
                  <div className="text-sm font-medium text-foreground">{q.title}</div>
                  <div className="mt-1 text-xs text-muted">{q.body}</div>
                  <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-primary">
                    Start <ArrowRight className="h-3 w-3" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card elevated className="p-6">
            <h3 className="text-sm font-semibold tracking-tight">Tips</h3>
            <ul className="mt-3 space-y-3 text-xs text-muted">
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Specify aspect ratio and palette in the prompt — it lifts scores by ~6 points on average.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Add a reference image when you need brand consistency.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                The editor lets you tweak headline, accent and layout without re-running models.
              </li>
            </ul>
          </Card>
        </section>
      </div>
    </>
  );
}
