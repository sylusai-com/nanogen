// src/app/admin/outputs/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon, Search, User } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Avatar from "@/components/ui/Avatar";
import Tabs from "@/components/ui/Tabs";
import Skeleton from "@/components/ui/Skeleton";
import EmptyData from "@/components/ui/EmptyData";
import { Input } from "@/components/ui/Input";
import Pagination from "@/components/ui/Pagination";
import { listAllBanners } from "@/lib/db/admin";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 24;

function aspectClass(a) {
  if (a === "1:1") return "aspect-square";
  if (a === "4:5") return "aspect-[4/5]";
  if (a === "9:16") return "aspect-[9/16]";
  return "aspect-video";
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

// Render the stored banner HTML in a sandboxed iframe — same approach as
// BannerThumb on the dashboard side. We inject CSS-var overrides + slot
// text replacements so the thumbnail matches the saved field values.
function buildSrcDoc(html, css, fields, alignment) {
  if (!html || !css) return null;
  let cssWithVars = css;
  const varOverrides = (fields || [])
    .filter(
      (f) =>
        f.cssVar && (f.type === "color" || f.type === "range" || f.type === "select"),
    )
    .map((f) => {
      const val = f.type === "range" ? `${f.value}${f.unit || ""}` : f.value;
      return `  ${f.cssVar}: ${val};`;
    })
    .join("\n");
  if (varOverrides) {
    cssWithVars = cssWithVars.includes(":root")
      ? cssWithVars.replace(/:root\s*{/, `:root {\n${varOverrides}`)
      : `:root {\n${varOverrides}\n}\n` + cssWithVars;
  }
  let htmlWithText = html;
  for (const f of fields || []) {
    if (f.type === "text" && f.slot) {
      htmlWithText = htmlWithText.replace(
        new RegExp(`(data-slot="${f.slot}"[^>]*)>([^<]*)`, "g"),
        `$1>${f.value ?? ""}`,
      );
    }
  }
  const aligned = htmlWithText.replace(
    /data-align="[^"]*"/,
    `data-align="${alignment || "left"}"`,
  );
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:transparent}
${cssWithVars}
</style></head><body>${aligned}</body></html>`;
}

function BannerCell({ banner }) {
  const srcDoc = useMemo(
    () =>
      buildSrcDoc(
        banner.html,
        banner.css,
        banner.fields,
        banner.alignment,
      ),
    [banner.html, banner.css, banner.fields, banner.alignment],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-border-strong">
      <div
        className={cn(aspectClass(banner.aspect), "relative overflow-hidden")}
        style={!srcDoc ? { background: banner.preview_gradient || "#0c0c10" } : undefined}
      >
        {srcDoc ? (
          <iframe
            title={banner.title}
            srcDoc={srcDoc}
            sandbox="allow-scripts"
            className="pointer-events-none h-full w-full border-0 bg-transparent"
          />
        ) : banner.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner.image_url}
            alt={banner.title}
            className="h-full w-full object-cover"
          />
        ) : null}

        {banner.score != null && (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 font-mono text-[10px] text-white backdrop-blur">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                banner.score >= 80 ? "bg-emerald-400" : "bg-amber-400",
              )}
            />
            {banner.score}
          </span>
        )}
      </div>
      <div className="space-y-2 border-t border-border bg-surface-2 px-3 py-2.5">
        <div className="truncate text-sm text-foreground">{banner.title}</div>

        {/* Creator — admin's main reason for being here */}
        <div className="flex items-center gap-2 rounded-md bg-background/50 px-2 py-1.5 text-[11px]">
          <Avatar name={banner.profiles?.name || ""} size={20} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-foreground">
              {banner.profiles?.name || "—"}
            </div>
            <div className="truncate text-[10px] text-muted">
              {banner.profiles?.email || "—"}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted">
          <span className="truncate">
            {banner.model_label || "—"} · {banner.style || "—"}
          </span>
          <span>{fmtDate(banner.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminOutputs() {
  const { user, supabase } = useAuth();
  const [all, setAll]   = useState(null);
  const [view, setView] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listAllBanners(supabase, { page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setAll(result.rows || []);
        setTotalPages(result.totalPages || 1);
        setTotalRows(result.total || 0);
      })
      .catch((e) => !cancelled && console.error("admin outputs", e));
    return () => { cancelled = true; };
  }, [user, supabase, page]);

  const filtered = useMemo(() => {
    if (!all) return [];
    let list = all;
    if (view === "passed")   list = list.filter((o) => (o.score ?? 0) >= 80);
    if (view === "filtered") list = list.filter((o) => (o.score ?? 0) < 80);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (o) =>
          (o.title || "").toLowerCase().includes(q) ||
          (o.profiles?.name || "").toLowerCase().includes(q) ||
          (o.profiles?.email || "").toLowerCase().includes(q) ||
          (o.style || "").toLowerCase().includes(q) ||
          (o.model_label || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [all, view, query]);

  useEffect(() => {
    // avoid synchronous setState inside effect
    Promise.resolve().then(() => setPage(1));
  }, [view, query]);

  const tabs = [
    { id: "all",      label: `All · ${all?.length ?? 0}` },
    { id: "passed",   label: `Passed · ${(all || []).filter((o) => (o.score ?? 0) >= 80).length}` },
    { id: "filtered", label: `Filtered · ${(all || []).filter((o) => (o.score ?? 0) < 80).length}` },
  ];

  return (
    <>
      <TopBar title="Outputs" action={null} />
      <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              Banners across the platform
            </h1>
            <p className="text-xs text-muted">
              Every saved banner, with its creator. Users can only see their own.
            </p>
          </div>
          <Tabs tabs={tabs} value={view} onChange={setView} />
        </div>

        {/* Search by user name / email / title / style */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by user, email, title, style…"
            className="pl-9"
          />
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
              <BannerCell key={o.id} banner={o} />
            ))}
          </div>
        ) : (
          <EmptyData
            icon={query ? <Search className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
            title={query ? "No matches" : "No banners yet"}
            body={
              query
                ? "Try a different search term."
                : "Saved banners appear here as users generate."
            }
          />
        )}

        {all && totalRows > 0 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </div>
    </>
  );
}