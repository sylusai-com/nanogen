"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Avatar from "@/components/ui/Avatar";
import Tabs from "@/components/ui/Tabs";
import Skeleton from "@/components/ui/Skeleton";
import EmptyData from "@/components/ui/EmptyData";
import { listAllBanners } from "@/lib/db/admin";
import { cn } from "@/lib/cn";

function aspectClass(a) {
  if (a === "1:1") return "aspect-square";
  if (a === "4:5") return "aspect-[4/5]";
  if (a === "9:16") return "aspect-[9/16]";
  return "aspect-video";
}

export default function AdminOutputs() {
  const { user, supabase } = useAuth();
  const [all, setAll] = useState(null);
  const [view, setView] = useState("all");

  useEffect(() => {
    if (!user) return;
    listAllBanners(supabase, { limit: 60 })
      .then(setAll)
      .catch((e) => console.error("admin outputs", e));
  }, [user, supabase]);

  const filtered = useMemo(() => {
    if (!all) return [];
    if (view === "passed") return all.filter((o) => (o.score ?? 0) >= 80);
    if (view === "filtered") return all.filter((o) => (o.score ?? 0) < 80);
    return all;
  }, [all, view]);

  const tabs = [
    { id: "all", label: `All · ${all?.length ?? 0}` },
    { id: "passed", label: `Passed · ${(all || []).filter((o) => (o.score ?? 0) >= 80).length}` },
    { id: "filtered", label: `Filtered · ${(all || []).filter((o) => (o.score ?? 0) < 80).length}` },
  ];

  return (
    <>
      <TopBar title="Outputs" action={null} />
      <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Recent banners</h1>
            <p className="text-xs text-muted">Live feed of saved banners across the platform.</p>
          </div>
          <Tabs tabs={tabs} value={view} onChange={setView} />
        </div>

        {all === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video" />
            ))}
          </div>
        ) : filtered.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((o) => (
              <div
                key={o.id}
                className="overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <div className={cn(aspectClass(o.aspect))} style={{ background: o.preview_gradient || undefined }}>
                  {o.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.image_url} alt={o.title} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="space-y-2 border-t border-border bg-surface-2 px-3 py-2.5">
                  <div className="truncate text-sm text-foreground">{o.title}</div>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0 text-muted">
                      <Avatar name={o.profiles?.name || ""} size={16} className="text-[8px]!" />
                      <span className="truncate">{o.profiles?.name || o.profiles?.email || "—"}</span>
                    </div>
                    {o.score != null && (
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono ${
                          o.score >= 80
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {o.score}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyData
            icon={<ImageIcon className="h-5 w-5" />}
            title="No banners yet"
            body="Saved banners appear here as users generate."
          />
        )}
      </div>
    </>
  );
}
