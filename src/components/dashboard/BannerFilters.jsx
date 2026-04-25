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
    <div className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center">
      <Tabs tabs={tabs} value={view} onChange={onView} />
      <Input
        placeholder="Search by title or model…"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        leftIcon={<Search className="h-4 w-4" />}
        className="md:w-72"
      />
    </div>
  );
}
