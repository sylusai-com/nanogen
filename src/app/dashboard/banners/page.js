"use client";

import { useMemo, useState } from "react";
import { Sparkles, ImageIcon } from "lucide-react";
import TopBar from "@/components/dashboard/TopBar";
import BannerThumb from "@/components/dashboard/BannerThumb";
import BannerFilters from "@/components/dashboard/BannerFilters";
import EmptyData from "@/components/ui/EmptyData";
import Button from "@/components/ui/Button";
import { listBanners } from "@/lib/mockData";

export default function BannersList() {
  const all = listBanners();
  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");

  const filtered = useMemo(() => {
    let list = all;
    if (view === "favourites") list = list.filter((b) => b.favourite);
    if (view === "passed") list = list.filter((b) => b.score >= 80);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.modelLabel.toLowerCase().includes(q) ||
          b.style.toLowerCase().includes(q),
      );
    }
    return list;
  }, [all, view, query]);

  const totals = {
    all: all.length,
    favs: all.filter((b) => b.favourite).length,
    passed: all.filter((b) => b.score >= 80).length,
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

        {filtered.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((b, i) => (
              <BannerThumb key={b.id} banner={b} index={i} />
            ))}
          </div>
        ) : (
          <EmptyData
            icon={<ImageIcon className="h-5 w-5" />}
            title="No matches"
            body="Try a different search or generate something new."
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
