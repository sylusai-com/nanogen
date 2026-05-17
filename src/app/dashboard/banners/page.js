// src/app/dashboard/banners/page.js
"use client";

// Unified Create + History hub. Inspired by Ideogram's layout:
//   - Prompt composer pinned at the top
//   - Generation runs as a non-blocking background job (popup bottom-right)
//   - Masonry-style grid below, newest first, infinite scroll
//
// Pagination uses an IntersectionObserver sentinel: the next page loads
// as soon as the user scrolls within ~600px of the bottom, so they never
// see prev/next buttons. CSS columns drive the masonry layout (no JS
// libraries, no per-tile height measurement) — it stays smooth even with
// 100+ banners loaded because BannerPreview also defers its srcDoc build
// until each tile actually enters the viewport.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Sparkles, AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import BannerThumb from "@/components/dashboard/BannerThumb";
import BannerFilters from "@/components/dashboard/BannerFilters";
import EmptyData from "@/components/ui/EmptyData";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import PromptForm from "@/components/generate/PromptForm";
import GenerationPopup from "@/components/generate/GenerationPopup";
import { listBanners } from "@/lib/db/banners";
import { cachedQuery, invalidateTags, useCacheTick } from "@/lib/cache";
import { GenerationSteps } from "@/lib/bannerGeneration";

const PAGE_SIZE = 12;

export default function BannersHub() {
  const router = useRouter();
  const { user, isAdmin, supabase } = useAuth();
  const userId = user?.id;
  const [query, setQuery] = useState("");
  const [view, setView]   = useState("all");

  // Infinite scroll state. `loadedPages` is the highest page number we've
  // fetched so far; the gallery shows pages 1..loadedPages concatenated.
  // Cap is enforced via `totalPages` returned by the server.
  const [loadedPages, setLoadedPages] = useState(1);
  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const sentinelRef = useRef(null);

  // useCacheTick fires whenever invalidateTags() runs (or any setCached
  // anywhere in the app). We use it to re-run the loader — soft-invalidation
  // keeps the stale rows visible, then the loader's results swap them in
  // place. No skeleton flash.
  const tick = useCacheTick();

  // Generation state — drives the floating popup.
  const [gen, setGen] = useState({
    open: false,
    aspect: "16:9",
    currentStep: null,
    stepsCompleted: [],
    stepsSkipped: [],
    done: false,
    error: null,
    successTitle: null,
    targetUrl: null,
    modelErrors: [],
    warning: null,
  });

  // Loader: fetches every page from 1..loadedPages in parallel via
  // cachedQuery (which dedupes in-flight requests and respects the same
  // 5-min TTL + tag invalidation the rest of the app uses). Concat +
  // de-dupe so a banner that shifted between pages while loading more
  // doesn't appear twice.
  useEffect(() => {
    if (!userId) {
      setInitialLoading(false);
      return;
    }
    let cancelled = false;
    const pages = Array.from({ length: loadedPages }, (_, i) => i + 1);
    setLoadingMore(true);
    Promise.all(
      pages.map((p) =>
        cachedQuery(
          ["banners", userId, p],
          () => listBanners(supabase, userId, { page: p, pageSize: PAGE_SIZE }),
          {
            ttlMs: 5 * 60_000,
            tags: ["banners", `banners:${userId}`],
          },
        ),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const seen = new Set();
        const merged = [];
        for (const r of results) {
          for (const row of r?.rows || []) {
            if (seen.has(row.id)) continue;
            seen.add(row.id);
            merged.push(row);
          }
        }
        setRows(merged);
        setTotalPages(results[results.length - 1]?.totalPages ?? 1);
        setLoadError(null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message || "Failed to load banners");
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingMore(false);
          setInitialLoading(false);
        }
      });
    return () => { cancelled = true; };
    // `tick` re-runs the loop on invalidation; `loadedPages` re-runs when
    // the sentinel asks for more.
  }, [userId, supabase, loadedPages, tick]);

  // IntersectionObserver — bumps `loadedPages` when the sentinel scrolls
  // into the bottom 600px of the viewport. Cleans up + re-arms whenever
  // the dependency state changes.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (initialLoading) return;
    if (loadingMore) return;
    if (totalPages == null || loadedPages >= totalPages) return;
    if (typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLoadedPages((p) => p + 1);
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [initialLoading, loadingMore, totalPages, loadedPages]);

  const pollGeneration = useCallback(async (jobId, maxAttempts = 240) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await fetch(`/api/generation-status/${jobId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Status request failed (${res.status})`);

      setGen((s) => ({
        ...s,
        currentStep: data.currentStep || s.currentStep,
        stepsCompleted: Array.isArray(data.stepsCompleted) ? data.stepsCompleted : s.stepsCompleted,
        stepsSkipped: Array.isArray(data.stepsSkipped) ? data.stepsSkipped : s.stepsSkipped,
      }));

      if (data.status === "completed") return data;
      if (data.status === "failed")    throw new Error(data.error || "Generation failed");
      await new Promise((r) => setTimeout(r, 800));
    }
    throw new Error("Generation timed out");
  }, []);

  const onSubmit = async (payload) => {
    setGen({
      open: true,
      aspect: payload.aspect || "16:9",
      currentStep: GenerationSteps.UPLOAD_IMAGES,
      stepsCompleted: [],
      stepsSkipped: [],
      done: false,
      error: null,
      successTitle: null,
      targetUrl: null,
      modelErrors: [],
      warning: null,
    });

    try {
      const res = await fetch("/api/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      if (!data.jobId) throw new Error("Server did not return a job ID");

      const generation = await pollGeneration(data.jobId);
      // Soft-invalidate: keeps existing rows visible while the loader
      // refetches, then swaps in the fresh list (including the new
      // banner). No skeleton flash on the gallery.
      invalidateTags(["banners", "generation_results", `banners:${userId || "anon"}`]);

      const banner = generation?.banner;
      const usedFallback = generation?.results?.usedFallback === true;
      const jobModelErrors = generation?.results?.modelErrors || [];

      setGen((s) => ({
        ...s,
        done: true,
        currentStep: null,
        stepsCompleted: Array.isArray(generation?.stepsCompleted) ? generation.stepsCompleted : s.stepsCompleted,
        stepsSkipped: Array.isArray(generation?.stepsSkipped) ? generation.stepsSkipped : s.stepsSkipped,
        successTitle: banner?.title || null,
        targetUrl: banner?.id ? `/dashboard/banners/${banner.id}/edit` : null,
        modelErrors: isAdmin && Array.isArray(jobModelErrors) ? jobModelErrors : [],
        warning: usedFallback
          ? (isAdmin
              ? "Banner saved using the static fallback template — every configured model errored or returned malformed output. Fix in Admin → Models."
              : "We couldn't reach the AI model just now, so we saved a default banner you can edit.")
          : null,
      }));
    } catch (err) {
      setGen((s) => ({
        ...s,
        done: false,
        error: err?.message || "Generation failed",
      }));
    }
  };

  const onCancel = () => {
    setGen({
      open: false,
      aspect: "16:9",
      currentStep: null,
      stepsCompleted: [],
      stepsSkipped: [],
      done: false,
      error: null,
      successTitle: null,
      targetUrl: null,
      modelErrors: [],
      warning: null,
    });
  };

  const onDismiss = () => {
    const target = gen.targetUrl;
    setGen((s) => ({ ...s, open: false }));
    if (target) router.push(target);
  };

  // Filter + search happen on the already-loaded accumulator. For very
  // large libraries we'd push these to the server, but for the dashboard
  // (rarely more than a few hundred rows) this is fine and immediate.
  const filtered = useMemo(() => {
    let list = rows;
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
  }, [rows, view, query]);

  const totals = {
    all: rows.length,
    favs: rows.filter((b) => b.favourite).length,
    passed: rows.filter((b) => (b.score ?? 0) >= 80).length,
  };

  const hasMore = totalPages != null && loadedPages < totalPages;
  const showEmptyState = !initialLoading && filtered.length === 0;

  return (
    <>
      <TopBar title="Create" />
      <div className="mx-auto w-full max-w-6xl space-y-8 px-5 py-8 md:px-8 md:py-10">
        {/* Composer */}
        <section className="space-y-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              What do you want to <span className="text-primary-gradient">create</span>?
            </h1>
            <p className="text-sm text-muted">
              Describe a banner. Recent generations appear below.
            </p>
          </div>
          <PromptForm onSubmit={onSubmit} isGenerating={gen.open && !gen.done && !gen.error} />
        </section>

        {gen.done && gen.warning && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Heads up</div>
              <div className="text-amber-300/80">{gen.warning}</div>
            </div>
          </div>
        )}

        {gen.done && gen.modelErrors.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-amber-200">
                  {gen.modelErrors.length} model{gen.modelErrors.length > 1 ? "s" : ""} failed during generation
                </div>
                <ul className="mt-2 space-y-1.5">
                  {gen.modelErrors.map((m, i) => (
                    <li key={i} className="text-amber-300/85">
                      <span className="font-mono text-amber-200/95">{m.modelLabel || m.modelId || "fallback"}</span>
                      <span className="text-amber-300/70">: {m.reason}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 text-[11px] text-amber-300/60">
                  The winner is shown. Fix the failing rows in Admin → Models.
                </div>
              </div>
            </div>
          </div>
        )}

        {loadError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
            {loadError}
          </div>
        )}

        {/* Filters */}
        <section className="rounded-2xl border border-border bg-surface-2/60 p-4">
          <BannerFilters
            query={query}
            onQuery={setQuery}
            view={view}
            onView={setView}
            total={totals}
          />
        </section>

        {/* Gallery — only show the skeleton placeholder on the FIRST load
            (when there's no data yet). Subsequent loads / invalidations
            keep showing the previous rows while the loader refreshes. */}
        {initialLoading && filtered.length === 0 ? (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="mb-4 aspect-video rounded-2xl break-inside-avoid" />
            ))}
          </div>
        ) : showEmptyState ? (
          <EmptyData
            icon={<ImageIcon className="h-5 w-5" />}
            title={query ? "No matches" : "No banners yet"}
            body={
              query
                ? "Try a different search."
                : "Generate your first banner using the composer above."
            }
            action={
              !query && (
                <Button leftIcon={<Sparkles className="h-3.5 w-3.5" />}>
                  Type a prompt above
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* CSS-columns masonry. Each tile sets `break-inside-avoid`
                so it never splits between columns. `gap` doesn't apply to
                columns, so per-tile `mb-4` provides the vertical rhythm.
                BannerThumb already renders at its native aspect (no
                frameAspect) — that's what produces the masonry's varied
                heights and the "real grid" look the gallery needs. */}
            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
              {filtered.map((b, i) => (
                <div key={b.id} className="mb-4 break-inside-avoid">
                  <BannerThumb banner={b} index={i} />
                </div>
              ))}
            </div>

            {/* Sentinel — when this scrolls into view, the IO above fires
                setLoadedPages(p => p + 1) and the loader fetches the next
                page. We render a small "loading more" indicator next to
                it so the user knows more is coming. */}
            <div ref={sentinelRef} className="flex h-12 items-center justify-center">
              {hasMore && (
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/60 px-3 py-1.5 text-[11px] text-muted">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading more
                </div>
              )}
              {!hasMore && filtered.length > 0 && (
                <div className="text-[11px] text-muted/60">
                  End of library
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <GenerationPopup
        open={gen.open}
        aspect={gen.aspect}
        currentStep={gen.currentStep}
        stepsCompleted={gen.stepsCompleted}
        stepsSkipped={gen.stepsSkipped}
        done={gen.done}
        error={gen.error}
        successTitle={gen.successTitle}
        onDismiss={onDismiss}
        onCancel={onCancel}
      />
    </>
  );
}
