// src/app/dashboard/banners/page.js
"use client";

// Unified Create + History hub. Inspired by Ideogram's layout:
//   - Prompt composer pinned at the top
//   - Generation runs as a non-blocking background job (popup bottom-right)
//   - Grid of past banners flows below, instantly scannable
//
// The old standalone /dashboard/create now redirects here. The marketing
// hero / stats sections were dropped because they pushed the gallery
// below the fold and competed with the composer for attention.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Sparkles, AlertCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import BannerThumb from "@/components/dashboard/BannerThumb";
import BannerFilters from "@/components/dashboard/BannerFilters";
import EmptyData from "@/components/ui/EmptyData";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import PromptForm from "@/components/generate/PromptForm";
import GenerationPopup from "@/components/generate/GenerationPopup";
import { listBanners } from "@/lib/db/banners";
import { useCachedQuery, invalidateTags } from "@/lib/cache";
import { GenerationSteps } from "@/lib/bannerGeneration";

const PAGE_SIZE = 12;

export default function BannersHub() {
  const router = useRouter();
  const { user, isAdmin, supabase } = useAuth();
  const userId = user?.id;
  const [query, setQuery] = useState("");
  const [view, setView]   = useState("all");
  const [page, setPage]   = useState(1);

  // Generation state — drives the floating popup. All fields are cleared
  // when the popup is dismissed.
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

  const { data: pageResult = null } = useCachedQuery(
    ["banners", userId, page],
    () => listBanners(supabase, userId, { page, pageSize: PAGE_SIZE }),
    {
      // Banners change after a mutation (create / update / favourite /
      // delete) — those paths invalidate the "banners" tag explicitly,
      // so a long TTL is safe and means navigating away and back is
      // instant. The previous 30s window forced a refetch every time.
      ttlMs: 5 * 60_000,
      tags: ["banners", `banners:${userId || "anon"}`],
      enabled: !!userId,
      // The list payload contains rendered html/css per banner — way
      // too heavy for sessionStorage. Keep it in-memory only; the
      // first visit per tab pays the network cost, navigations after
      // that hit the in-memory tier.
      persist: false,
    },
  );

  const all = pageResult?.rows ?? null;

  // Poll the active job until it terminates. Returns the final status
  // payload so the caller can route to the new banner.
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
      invalidateTags(["banners", "generation_results", `banners:${userId || "anon"}`]);

      const banner = generation?.banner;
      // Only flag a warning when the LITERAL fallback template was
      // shipped (LLM call failed, malformed JSON, missing model, etc).
      // A model output that scored below 80 is still a real banner —
      // surfacing the "we couldn't reach the AI" message there would
      // (and did) terrify users for no reason.
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

  // When the user clicks "Cancel" mid-generation we close the popup but
  // do NOT abort the upstream job — the backend doesn't expose cancel
  // yet, so the safest UX is to drop the in-flight UI state and let the
  // job finish silently. Future: hit /api/generation-status/[id]/cancel.
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

  // Flat list, newest first. The previous version grouped siblings by
  // run and rendered each group as its own <section> — which on real
  // data (most runs produce a single variant under the new "auto picks
  // best model" path) made the page feel like one banner per row instead
  // of a dense gallery. Ideogram-style: one flat grid, newest first,
  // every cell the same size.
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
    return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [all, view, query]);

  const totalPages = pageResult?.totalPages ?? 1;
  const totalRows = pageResult?.total ?? 0;

  const totals = {
    all: all?.length ?? 0,
    favs: (all || []).filter((b) => b.favourite).length,
    passed: (all || []).filter((b) => (b.score ?? 0) >= 80).length,
  };

  return (
    <>
      <TopBar title="Create" />
      <div className="mx-auto w-full max-w-6xl space-y-8 px-5 py-8 md:px-8 md:py-10">
        {/* Composer — pinned at the top */}
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

        {/* One-time admin-only error / fallback warnings, surfaced after
            generation finishes. Non-admin users only see the high-level
            "saved a default" warning. */}
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

        {/* Filters bar */}
        <section className="rounded-2xl border border-border bg-surface-2/60 p-4">
          <BannerFilters
            query={query}
            onQuery={setQuery}
            view={view}
            onView={setView}
            total={totals}
          />
        </section>

        {/* Gallery */}
        {all === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video rounded-2xl" />
            ))}
          </div>
        ) : filtered.length ? (
          // Single flat grid — Ideogram-style. Uniform 16:9 frame across
          // every cell so 1:1 / 9:16 / 4:5 banners don't stretch rows to
          // different heights. The source banner still renders at its
          // true aspect, just centered inside the 16:9 cell.
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((b, i) => (
              <BannerThumb
                key={b.id}
                banner={b}
                index={i}
                frameAspect="16:9"
              />
            ))}
          </div>
        ) : (
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
        )}

        {pageResult && filtered.length > 0 && totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        )}

        {pageResult && filtered.length === 0 && totalRows > 0 && (
          <div className="rounded-2xl border border-border bg-surface-2/70 p-4 text-sm text-muted">
            No matches on this page.
          </div>
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
