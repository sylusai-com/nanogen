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

  const filtered = useMemo(() => {
    if (!all) return [];
    let list = all;
    if (view === "favourites") list = list.filter((b) => b.favourite);
    if (view === "passed") list = list.filter((b) => (b.score ?? 0) >= 80);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (b) =>
          (b.title || "").toLowerCase().includes(q) ||
          (b.modelLabel || "").toLowerCase().includes(q) ||
          (b.style || "").toLowerCase().includes(q),
      );
    }
    return list;
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
        ) : filtered.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((b, i) => (
              <BannerThumb key={b.id} banner={b} index={i} />
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
