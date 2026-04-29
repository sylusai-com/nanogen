// src/app/dashboard/banners/page.js
"use client";

import { useMemo, useState } from "react";
import { Sparkles, ImageIcon } from "lucide-react";
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
      .map((g) => ({
        ...g,
        items: [...g.items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return groups;
  }, [all, view, query]);

  const totals = {
    all: all?.length ?? 0,
    favs: (all || []).filter((b) => b.favourite).length,
    passed: (all || []).filter((b) => (b.score ?? 0) >= 80).length,
  };

  return (
    <>
      <TopBar title="Banners" />
      <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <BannerFilters
          query={query}
          onQuery={setQuery}
          view={view}
          onView={setView}
          total={totals}
        />

        {all === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video" />
            ))}
          </div>
        ) : grouped.length ? (
          <div className="space-y-6">
            {grouped.map((group) => (
              <section
                key={group.runId}
                className="rounded-2xl border border-border bg-surface-2/50 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {group.prompt}
                    </h3>
                    <div className="text-[11px] text-muted">
                      {group.items.length} model result{group.items.length > 1 ? "s" : ""} · {group.style || "—"} · {group.aspect || "—"}
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
