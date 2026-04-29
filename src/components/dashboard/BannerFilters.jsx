"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import Tabs from "@/components/ui/Tabs";

export default function BannerFilters({ query, onQuery, view, onView, total }) {
  const tabs = [
    { id: "all", label: `All · ${total.all}` },
    { id: "favourites", label: `Favourites · ${total.favs}` },
    { id: "passed", label: `Passed · ${total.passed}` },
  ];

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Library filters
        </div>
        <div className="text-sm text-muted">
          Toggle the view, then search across prompt, model, and style.
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs tabs={tabs} value={view} onChange={onView} />
        <Input
          placeholder="Search prompts, models, styles…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
          className="sm:w-80"
        />
      </div>
    </div>
  );
}
