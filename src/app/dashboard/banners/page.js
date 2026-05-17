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
import { ImageIcon, Sparkles, AlertCircle, AlertTriangle, Loader2, ArrowUp } from "lucide-react";
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
  // `displayed` is what the user currently sees. `incoming` is what the
  // loader most recently fetched. They diverge when the user is scrolled
  // away from the top and a new banner lands: we don't want to push the
  // existing rows down beneath them mid-scroll. Instead we hold the
  // fresh set in `incoming` and surface a small "X new" pill the user
  // can click to merge + scroll to top.
  const [displayed, setDisplayed] = useState([]);
  const [incoming, setIncoming] = useState(null);
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
    // The full saved banner row (html/css/fields/alignment/aspect) once
    // the job completes — flows into GenerationPopup so it can swap the
    // skeleton for the real banner the moment generation finishes.
    banner: null,
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
        // Per-page results come back already ordered by created_at DESC,
        // but pagination + caching can desync the pages (a stale page 1
        // mixed with a fresh page 2, or a new banner landing between
        // queries, can shift items across page boundaries). A single
        // final sort on the merged accumulator guarantees that "newest
        // first" holds regardless of how the pages arrived — without
        // this, scrolling triggers loadedPages++ and refetches, and any
        // newly-inserted banner appears in the middle of the list
        // instead of at the top.
        merged.sort((a, b) => {
          const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
        setTotalPages(results[results.length - 1]?.totalPages ?? 1);
        setLoadError(null);
        // Decide whether to swap immediately or stash the result for a
        // user-triggered merge:
        //   1. First load (displayed is empty) → swap.
        //   2. Just paginated (merged grew) → swap, no reordering of
        //      existing rows above the fold.
        //   3. New banner landed (head id differs from what we had)
        //      AND the user is scrolled away from the top → hold it
        //      in `incoming` and surface the "X new" pill.
        //   4. Same as 3 but the user is at/near the top → swap (no
        //      visible shift anyway).
        const NEAR_TOP = 200;
        const atTop = typeof window === "undefined" || window.scrollY < NEAR_TOP;
        const prevHead = displayed[0]?.id;
        const nextHead = merged[0]?.id;
        const headChanged = prevHead && nextHead && prevHead !== nextHead;
        const grew = merged.length > displayed.length;

        if (displayed.length === 0) {
          setDisplayed(merged);
          setIncoming(null);
        } else if (grew && !headChanged) {
          // Pure pagination append — safe to swap, head didn't move.
          setDisplayed(merged);
          setIncoming(null);
        } else if (headChanged && !atTop) {
          // New content arrived above the user's scroll. Hold it so we
          // don't yank the page out from under them. We still merge the
          // existing displayed ids underneath so paginated rows the
          // user already scrolled to don't disappear when they later
          // click the "show new" pill.
          setIncoming(merged);
        } else {
          // At the top, or no head change — safe to swap.
          setDisplayed(merged);
          setIncoming(null);
        }
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
    // the sentinel asks for more. `displayed` is intentionally NOT in
    // the deps — reading it through the closure is what lets the resolve
    // handler decide whether to stash vs swap based on the state that
    // existed when the fetch fired, not after our own setDisplayed call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      banner: null,
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
        // Stash the renderable banner so GenerationPopup can swap its
        // skeleton for the real preview the instant the job lands.
        banner: banner || null,
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
      banner: null,
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
    let list = displayed;
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
  }, [displayed, view, query]);

  const totals = {
    all: displayed.length,
    favs: displayed.filter((b) => b.favourite).length,
    passed: displayed.filter((b) => (b.score ?? 0) >= 80).length,
  };

  // Count of new banners waiting above the fold (diff against current
  // displayed set by id) — drives the "X new — show" pill.
  const newCount = useMemo(() => {
    if (!incoming) return 0;
    const have = new Set(displayed.map((b) => b.id));
    return incoming.filter((b) => !have.has(b.id)).length;
  }, [incoming, displayed]);

  const showIncoming = useCallback(() => {
    if (!incoming) return;
    setDisplayed(incoming);
    setIncoming(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [incoming]);

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

        {/* "X new banners" pill — only shows when the user is scrolled
            away from the top and fresh rows are waiting. Clicking it
            swaps in the fresh set and scrolls back up smoothly, which
            stops the gallery from shoving the user's current view down
            every time a generation completes. */}
        {newCount > 0 && (
          <div className="sticky top-3 z-30 flex justify-center">
            <button
              type="button"
              onClick={showIncoming}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3.5 py-1.5 text-xs font-medium text-primary shadow-[0_8px_30px_-12px_rgba(167,139,250,0.55)] backdrop-blur transition-colors hover:bg-primary/25"
            >
              <ArrowUp className="h-3 w-3" />
              {newCount} new banner{newCount > 1 ? "s" : ""} — show
            </button>
          </div>
        )}

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
            {/* Row-wise masonry. CSS `columns` fills column 1 completely
                before flowing into column 2, which means newest items
                land at the bottom of column 1 — and every pagination
                bump reshuffles the column boundaries because the column
                heights re-balance around the new items. We instead split
                the array into N parallel lists in round-robin order
                (item i → list i % N), then render each list as a
                vertical flex column. That gives true row-wise reading
                order (1 2 3 4 / 5 6 7 8 / …), preserves masonry heights
                (each column independently flows its own tiles), and
                keeps existing tiles in the same column when new items
                are appended at the end. */}
            <MasonryGrid items={filtered} />

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
        banner={gen.banner}
        onDismiss={onDismiss}
        onCancel={onCancel}
      />
    </>
  );
}

// Render the gallery as a row-wise masonry. We compute the column count
// from the current viewport (1 / 2 / 3 / 4 matching the page's responsive
// breakpoints) and round-robin the items into that many vertical lists.
// Each list renders as its own flex column so per-tile heights still
// vary, but the reading order across columns is row-wise.
function MasonryGrid({ items }) {
  const [cols, setCols] = useState(getColumnCount());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setCols(getColumnCount());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Round-robin distribution: item i → column (i % cols). With items
  // ordered newest-first this means the newest banner always lands at
  // the top of column 0, the second-newest at the top of column 1, etc.
  // — which is the row-wise pattern the user expects.
  const columns = useMemo(() => {
    const buckets = Array.from({ length: cols }, () => []);
    items.forEach((b, i) => {
      buckets[i % cols].push({ banner: b, index: i });
    });
    return buckets;
  }, [items, cols]);

  return (
    <div className="flex gap-4">
      {columns.map((col, ci) => (
        <div key={ci} className="flex min-w-0 flex-1 flex-col gap-4">
          {col.map(({ banner, index }) => (
            <BannerThumb key={banner.id} banner={banner} index={index} />
          ))}
        </div>
      ))}
    </div>
  );
}

function getColumnCount() {
  if (typeof window === "undefined") return 4;
  const w = window.innerWidth;
  if (w >= 1280) return 4; // xl
  if (w >= 1024) return 3; // lg
  if (w >= 640) return 2;  // sm
  return 1;
}
