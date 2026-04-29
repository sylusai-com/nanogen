// src/app/dashboard/banners/page.js
"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Sparkles,
  ImageIcon,
  LayoutGrid,
  Layers3,
  Wand2,
} from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import BannerThumb from "@/components/dashboard/BannerThumb";
import BannerFilters from "@/components/dashboard/BannerFilters";
import EmptyData from "@/components/ui/EmptyData";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import { listBanners } from "@/lib/db/banners";
import { useCachedQuery } from "@/lib/cache";

export default function BannersList() {
  const { user, supabase } = useAuth();
  const userId = user?.id;
  const [query, setQuery] = useState("");
  const [view, setView]   = useState("all");

  // Banner list is hot — cache for 30s with stale-while-revalidate so
  // navigating between detail/edit and back is instant. The cache
  // invalidates the "banners" tag whenever a banner is created
  // (/api/banners), updated (editor), favourited, or deleted.
  const { data: all = null } = useCachedQuery(
    ["banners", userId],
    () => listBanners(supabase),
    { ttlMs: 30_000, tags: ["banners", `banners:${userId || "anon"}`], enabled: !!userId },
  );

  const grouped = useMemo(() => {
    if (!all) return [];
    let list = all;
    if (view === "favourites") list = list.filter((b) => b.favourite);
    if (view === "passed") list = list.filter((b) => (b.score ?? 0) >= 80);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (b) =>
          (b.title || "").toLowerCase().includes(q) ||
          (b.prompt || "").toLowerCase().includes(q) ||
          (b.modelLabel || "").toLowerCase().includes(q) ||
          (b.style || "").toLowerCase().includes(q),
      );
    }

    const byRun = new Map();
    for (const banner of list) {
      const runKey = banner.runId || banner.id;
      const existing = byRun.get(runKey);
      if (!existing) {
        byRun.set(runKey, {
          runId: runKey,
          prompt: banner.prompt || banner.title || "Untitled prompt",
          style: banner.style,
          aspect: banner.aspect,
          createdAt: banner.createdAt,
          items: [banner],
        });
        continue;
      }
      existing.items.push(banner);
      if (!existing.createdAt || new Date(banner.createdAt) > new Date(existing.createdAt)) {
        existing.createdAt = banner.createdAt;
      }
    }

    const groups = [...byRun.values()]
      .map((g) => {
        const items = [...g.items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        return {
          ...g,
          items,
          bestScore: items[0]?.score ?? null,
          topModel: items[0]?.modelLabel || items[0]?.title || "—",
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return groups;
  }, [all, view, query]);

  const totals = {
    all: all?.length ?? 0,
    favs: (all || []).filter((b) => b.favourite).length,
    passed: (all || []).filter((b) => (b.score ?? 0) >= 80).length,
  };

  const groupCount = grouped.length;
  const avgPerGroup = groupCount ? Math.round((totals.all / groupCount) * 10) / 10 : 0;

  return (
    <>
      <TopBar title="Banners" />
      <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(9,9,16,0.98))] p-6 shadow-[0_24px_90px_-48px_rgba(0,0,0,0.75)] md:p-8">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-size-[24px_24px] opacity-30" />
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-fuchsia-400/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/75 backdrop-blur">
                <Wand2 className="h-3.5 w-3.5 text-cyan-300" />
                Curated banner library
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Banner gallery, reworked for fast scanning and sharper decisions.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 md:text-[15px]">
                  Every prompt is grouped by run, with all model variants shown together so you can compare composition, score, and style without leaving the page.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur">
                  <LayoutGrid className="h-3.5 w-3.5 text-emerald-300" />
                  {groupCount} prompt group{groupCount === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur">
                  <Layers3 className="h-3.5 w-3.5 text-cyan-300" />
                  {totals.all} saved banner{totals.all === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur">
                  <ArrowRight className="h-3.5 w-3.5 text-fuchsia-300" />
                  {avgPerGroup} outputs per prompt
                </span>
              </div>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-105 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Total banners</div>
                <div className="mt-2 text-3xl font-semibold text-white">{totals.all}</div>
                <div className="mt-1 text-xs text-white/55">Across all saved generation runs</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Top scored</div>
                <div className="mt-2 text-3xl font-semibold text-white">{totals.passed}</div>
                <div className="mt-1 text-xs text-white/55">Reached the score threshold</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Favourite picks</div>
                <div className="mt-2 text-3xl font-semibold text-white">{totals.favs}</div>
                <div className="mt-1 text-xs text-white/55">Marked for reuse or review</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Runs</div>
                <div className="mt-2 text-3xl font-semibold text-white">{groupCount}</div>
                <div className="mt-1 text-xs text-white/55">Grouped prompt sessions</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface-2/80 p-4 shadow-[0_18px_50px_-40px_rgba(0,0,0,0.55)] backdrop-blur">
          <BannerFilters
            query={query}
            onQuery={setQuery}
            view={view}
            onView={setView}
            total={totals}
          />
        </section>

        {all === null ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, groupIndex) => (
              <section key={groupIndex} className="rounded-2xl border border-border bg-surface-2/50 p-4">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-8 w-24 rounded-full" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-video rounded-2xl" />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : grouped.length ? (
          <div className="space-y-6">
            {grouped.map((group) => (
              <section
                key={group.runId}
                className="overflow-hidden rounded-3xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-4 shadow-[0_18px_60px_-44px_rgba(0,0,0,0.6)] md:p-5"
              >
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted">
                      <span>Prompt run</span>
                      <span className="h-1 w-1 rounded-full bg-muted" />
                      <span>{group.items.length} variants</span>
                      <span className="h-1 w-1 rounded-full bg-muted" />
                      <span>{group.style || "Modern"}</span>
                    </div>
                    <h3 className="truncate text-lg font-semibold tracking-tight text-foreground md:text-xl">
                      {group.prompt}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{group.items.length} model result{group.items.length > 1 ? "s" : ""}</span>
                      <span>•</span>
                      <span>{group.aspect || "—"}</span>
                      <span>•</span>
                      <span>Best score {group.bestScore ?? "—"}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-medium text-muted-strong">
                      Top model: {group.topModel}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-medium text-muted-strong">
                      Created {group.createdAt ? new Date(group.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                    </span>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {group.items.map((b, i) => (
                    <BannerThumb key={b.id} banner={b} index={i} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyData
            icon={<ImageIcon className="h-5 w-5" />}
            title={query ? "No matches" : "No banners yet"}
            body={
              query
                ? "Try a different search or generate something new."
                : "Generate your first banner to see it here."
            }
            action={
              <Button href="/dashboard/create" leftIcon={<Sparkles className="h-3.5 w-3.5" />}>
                Create banner
              </Button>
            }
          />
        )}
      </div>
    </>
  );
}
