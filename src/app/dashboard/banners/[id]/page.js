// src/app/dashboard/banners/[id]/page.js
"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ImageOff,
  ImageIcon,
  Loader2,
  PenTool,
  Share2,
  Star,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Skeleton from "@/components/ui/Skeleton";
import EmptyData from "@/components/ui/EmptyData";
import DownloadMenu from "@/components/banner/DownloadMenu";
import ReferencePanel from "@/components/banner/ReferencePanel";
import RegeneratePanel from "@/components/banner/RegeneratePanel";
import BannerPreview from "@/components/banner/BannerPreview";
import { cn } from "@/lib/cn";
import { deleteBanner, getBanner, toggleFavourite, updateBanner } from "@/lib/db/banners";
import { useCachedQuery } from "@/lib/cache";

function aspectClass(a) {
  if (a === "1:1") return "aspect-square";
  if (a === "4:5") return "aspect-[4/5]";
  if (a === "9:16") return "aspect-[9/16]";
  return "aspect-video";
}

export default function BannerDetail({ params }) {
  const { id } = use(params);
  const { user, supabase, isAdmin } = useAuth();
  const router = useRouter();
  const userId = user?.id;
  const [busy, setBusy] = useState(false);
  const [bgSaving, setBgSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  // Toggle for the photographic bg layer that the bg-image provider
  // generated alongside the HTML/CSS banner. The truth lives on the
  // banner row's `fields[bg_image_enabled]`, which is also what the
  // builder, dashboard thumbs, and exports all read — flipping the
  // toggle here PERSISTS so the choice is reflected in every other
  // surface (preview iframe, builder, list grid).
  //
  // `optimisticShowBg` lets the UI flip instantly while the save round-
  // trip is in flight; once `refresh()` resolves and the banner row
  // carries the new field value, we clear the optimistic override and
  // fall back to the persisted value. Storing this as `null` / boolean
  // (rather than a synced `useEffect`) avoids the React 19 "setState
  // inside useEffect" lint and keeps render order strictly derivational.
  const [optimisticShowBg, setOptimisticShowBg] = useState(null);

  // Cached + stale-while-revalidate. Tagged on `banner:{id}` so updates
  // / deletes / favourites in the dashboard or editor invalidate this
  // single-row entry without nuking the whole banners list.
  const {
    data: banner = null,
    isLoading: loading,
    refresh,
  } = useCachedQuery(
    ["banner", id, userId],
    () => getBanner(supabase, userId, id),
    {
      ttlMs: 5 * 60_000,
      tags: ["banners", `banner:${id}`, `banners:${userId || "anon"}`],
      enabled: !!userId,
      // Single banner rows include html/css/fields — these can be tens
      // of KB. Stay in-memory only so we don't blow the sessionStorage
      // quota after a user browses through a handful of banners.
      persist: false,
    },
  );

  // Local optimistic-update helper — UI patches the cached row immediately
  // and refresh() reconciles in the background.
  const patchBanner = (next) => {
    if (!next) return;
    // The hook reads from the module cache — calling refresh re-sets it
    // from the source. Prefer that over re-implementing local state.
    refresh().catch(() => {});
  };

  const onToggleFavourite = async () => {
    if (!banner) return;
    setBusy(true);
    try {
      const next = await toggleFavourite(supabase, userId, banner.id, !banner.favourite);
      patchBanner(next);
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const onDelete = async () => {
    if (!banner) return;
    setBusy(true);
    try {
      await deleteBanner(supabase, userId, banner.id);
      router.push("/dashboard/banners");
    } catch (e) {
      alert(e.message || "Failed to delete");
      setBusy(false);
    } finally {
      setDeleteOpen(false);
    }
  };

  // Does this banner actually carry a photographic bg image? Detected
  // off the bg_image field (preferred — what the renderer reads) and
  // falling back to image_url for legacy rows. We use it to (a) decide
  // whether to even show the toggle, (b) drive its visible state, and
  // (c) compute the banner variant fed to BannerPreview.
  //
  // Both hooks live ABOVE the early returns below so they run in the
  // same order on every render — react-hooks/rules-of-hooks.
  const hasBgImage = useMemo(() => {
    if (!banner) return false;
    const f = (banner.fields || []).find((x) => x?.id === "bg_image");
    const raw = String(f?.value || banner.imageUrl || "").trim();
    if (!raw || raw === "none") return false;
    const m = raw.match(/^url\(\s*["']?(.*?)["']?\s*\)$/i);
    const inner = (m ? m[1] : raw).trim();
    return /^(?:https?:\/\/|data:image\/)/i.test(inner);
  }, [banner]);

  // Persisted value from the banner row — defaults to ON for legacy
  // rows that pre-date `bg_image_enabled`. The visible `showBg` prefers
  // the in-flight optimistic value when one is set (so the toggle
  // animates without waiting for the round-trip), otherwise falls back
  // to whatever the row currently has.
  const persistedShowBg = useMemo(() => {
    if (!banner) return true;
    const f = (banner.fields || []).find((x) => x?.id === "bg_image_enabled");
    return f ? f.value !== false : true;
  }, [banner]);
  const showBg = optimisticShowBg ?? persistedShowBg;

  // Toggle handler — flips local state immediately for snappy UI, then
  // writes the new value back to `fields[bg_image_enabled]` on the
  // banner row. The DB write invalidates the shared cache so every
  // other surface that reads this banner (builder, gallery thumbs,
  // generation popup) re-renders with the new value.
  const persistBgToggle = async (next) => {
    if (!banner || bgSaving) return;
    setOptimisticShowBg(next);
    setBgSaving(true);
    try {
      const existing = Array.isArray(banner.fields) ? banner.fields : [];
      const hasField = existing.some((f) => f?.id === "bg_image_enabled");
      const nextFields = hasField
        ? existing.map((f) =>
            f?.id === "bg_image_enabled" ? { ...f, value: next } : f,
          )
        : [
            ...existing,
            {
              id: "bg_image_enabled",
              type: "toggle",
              label: "Show background image",
              value: next,
            },
          ];
      await updateBanner(supabase, userId, banner.id, { fields: nextFields });
      await refresh();
      // Clear the optimistic override now that the persisted row carries
      // the new value — subsequent renders pull from `persistedShowBg`.
      setOptimisticShowBg(null);
    } catch (e) {
      // Roll back local state on failure so the UI matches the source
      // of truth — user can retry the toggle.
      setOptimisticShowBg(null);
      alert(e.message || "Failed to save bg image setting");
    } finally {
      setBgSaving(false);
    }
  };

  // Override the `bg_image_enabled` toggle field on the banner row when
  // the user flips the local UI toggle. Cloning here (vs mutating) keeps
  // the cached banner row pristine — the next render with showBg=true
  // gets back the original fields without a refetch.
  const previewBanner = useMemo(() => {
    if (!banner) return null;
    if (!hasBgImage || showBg) return banner;
    const fields = (banner.fields || []).map((f) =>
      f?.id === "bg_image_enabled" ? { ...f, value: false } : f,
    );
    if (!fields.some((f) => f?.id === "bg_image_enabled")) {
      fields.push({
        id: "bg_image_enabled",
        type: "toggle",
        label: "Show background image",
        value: false,
      });
    }
    return { ...banner, fields };
  }, [banner, hasBgImage, showBg]);

  if (loading) {
    return (
      <>
        <TopBar />
        <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 md:px-8 md:py-10">
          <Skeleton className="aspect-video" />
        </div>
      </>
    );
  }

  if (!banner) {
    return (
      <>
        <TopBar />
        <div className="mx-auto w-full max-w-3xl px-5 py-10">
          <EmptyData
            title="Banner not found"
            body="It may have been deleted, or you don't have access."
            action={<Button href="/dashboard/banners">Back to banners</Button>}
          />
        </div>
      </>
    );
  }

  const hasTemplate = Boolean(banner.html && banner.css);

  const meta = [
    { label: "Model",   value: banner.modelLabel || "—" },
    { label: "Style",   value: banner.style       || "—" },
    { label: "Aspect",  value: banner.aspect       || "—" },
    {
      label: "Created",
      value: banner.createdAt
        ? new Date(banner.createdAt).toLocaleDateString()
        : "—",
    },
  ];

  return (
    <>
      <TopBar title="Banner" />
      <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <Link
          href="/dashboard/banners"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All banners
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Preview + inline regeneration composer */}
          <div className="space-y-6">
          <Card elevated className="p-3">
            {hasTemplate ? (
              <div className="space-y-3">
                <BannerPreview banner={previewBanner} className="rounded-xl" />
                {hasBgImage && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/60 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-foreground">
                        Background image
                      </div>
                      <div className="text-[11px] text-muted">
                        {bgSaving
                          ? "Saving…"
                          : showBg
                            ? "Photo backdrop from the bg provider is on."
                            : "Showing the model's CSS-only design."}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => persistBgToggle(!showBg)}
                      disabled={bgSaving}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-60",
                        showBg
                          ? "border-primary/40 bg-primary/15 text-primary hover:bg-primary/25"
                          : "border-border bg-surface text-muted-strong hover:bg-surface-2",
                      )}
                      aria-pressed={showBg}
                    >
                      {bgSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : showBg ? (
                        <ImageIcon className="h-3.5 w-3.5" />
                      ) : (
                        <ImageOff className="h-3.5 w-3.5" />
                      )}
                      {showBg ? "With bg image" : "Without bg image"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className={cn(aspectClass(banner.aspect), "rounded-xl overflow-hidden")}>
                <div className="flex h-full w-full items-center justify-center rounded-xl border border-border bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_38%),linear-gradient(135deg,#0c0c10,#17172a)] p-8 text-center">
                  <div className="max-w-sm space-y-2">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted">HTML + CSS banner</div>
                    <div className="text-lg font-semibold tracking-tight text-foreground">Preview unavailable</div>
                    <div className="text-sm text-muted">This banner should render from the stored HTML/CSS template. If you see this state, the template is missing or invalid.</div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Inline regeneration — replaces the old modal dialog so the
              prompt box lives right on this page. */}
          <RegeneratePanel banner={banner} />
          </div>

          <div className="space-y-4">
            {/* Meta */}
            <Card elevated className="p-5">
              <button
                type="button"
                onClick={() => setMetaOpen(!metaOpen)}
                className="flex w-full items-start justify-between gap-3 text-left focus:outline-none"
              >
                <div>
                  <h1 className="text-lg font-semibold tracking-tight">{banner.title}</h1>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && banner.score != null && (
                    <Badge tone={banner.score >= 80 ? "success" : "warning"} dot>
                      Score {banner.score}
                    </Badge>
                  )}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted transition-transform duration-200",
                      metaOpen && "rotate-180"
                    )}
                  />
                </div>
              </button>
              
              {metaOpen && (
                <div className="mt-4 border-t border-border pt-4">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    {meta.map((m) => (
                      <div key={m.label}>
                        <dt className="text-[11px] uppercase tracking-widest text-muted">
                          {m.label}
                        </dt>
                        <dd className="mt-0.5 text-foreground">{m.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </Card>

            {/* Actions */}
            <Card elevated className="p-5">
              <h3 className="text-sm font-semibold tracking-tight">Actions</h3>
              <div className="mt-3 space-y-2">
                {/* Primary: open the builder. The builder hosts every
                    field-editing surface (text, colors, media, advanced,
                    layout) plus the canvas-style overlay editor in one
                    place — there's no longer a separate fields-only view. */}
                <Button
                  href={`/dashboard/builder/${banner.id}`}
                  variant="primary"
                  className="w-full"
                  leftIcon={<PenTool className="h-3.5 w-3.5" />}
                >
                  Open in builder
                </Button>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <DownloadMenu
                    banner={banner}
                    className="w-full"
                    buttonClassName="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 text-xs font-medium text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
                  />
                  <Button
                    variant="secondary"
                    onClick={handleShare}
                    leftIcon={<Share2 className="h-3.5 w-3.5" />}
                  >
                    Share
                  </Button>
                </div>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={onToggleFavourite}
                  disabled={busy}
                  leftIcon={
                    <Star
                      className="h-3.5 w-3.5"
                      strokeWidth={banner.favourite ? 0 : 2}
                      fill={banner.favourite ? "currentColor" : "none"}
                    />
                  }
                >
                  {banner.favourite ? "Unfavourite" : "Favourite"}
                </Button>
              </div>

              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                disabled={busy}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete banner
              </button>
            </Card>

            {/* Reference image + AI-extracted context, when the user
                attached a reference at /dashboard/create. Hidden when
                this banner has no reference. */}
            <ReferencePanel
              imageUrl={banner.referenceImageUrl}
              context={banner.referenceContext}
              subjectImageUrl={banner.subjectImageUrl}
              subjectContext={banner.subjectContext}
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this banner?"
        description="This will permanently remove the banner from your dashboard and cannot be undone."
        confirmLabel="Delete banner"
        loading={busy}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={onDelete}
      />
    </>
  );
}