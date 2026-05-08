// src/app/dashboard/banners/[id]/page.js
"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit3,
  Loader2,
  PenTool,
  RefreshCcw,
  Share2,
  Star,
  Trash2,
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
import RegenerateDialog from "@/components/banner/RegenerateDialog";
import BannerPreview from "@/components/banner/BannerPreview";
import { cn } from "@/lib/cn";
import { deleteBanner, getBanner, toggleFavourite } from "@/lib/db/banners";
import { useCachedQuery } from "@/lib/cache";

function aspectClass(a) {
  if (a === "1:1") return "aspect-square";
  if (a === "4:5") return "aspect-[4/5]";
  if (a === "9:16") return "aspect-[9/16]";
  return "aspect-video";
}

export default function BannerDetail({ params }) {
  const { id } = use(params);
  const { user, supabase } = useAuth();
  const router = useRouter();
  const userId = user?.id;
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);

  // Cached + stale-while-revalidate. Tagged on `banner:{id}` so updates
  // / deletes / favourites in the dashboard or editor invalidate this
  // single-row entry without nuking the whole banners list.
  const {
    data: banner = null,
    isLoading: loading,
    refresh,
  } = useCachedQuery(
    ["banner", id, userId],
    () => getBanner(supabase, id),
    {
      ttlMs: 60_000,
      tags: ["banners", `banner:${id}`, `banners:${userId || "anon"}`],
      enabled: !!userId,
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
      const next = await toggleFavourite(supabase, banner.id, !banner.favourite);
      patchBanner(next);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!banner) return;
    setBusy(true);
    try {
      await deleteBanner(supabase, banner.id);
      router.push("/dashboard/banners");
    } catch (e) {
      alert(e.message || "Failed to delete");
      setBusy(false);
    } finally {
      setDeleteOpen(false);
    }
  };

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
          {/* Preview */}
          <Card elevated className="p-3">
            {hasTemplate ? (
              <BannerPreview banner={banner} className="rounded-xl" />
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

          <div className="space-y-4">
            {/* Meta */}
            <Card elevated className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-lg font-semibold tracking-tight">{banner.title}</h1>
                {banner.score != null && (
                  <Badge tone={banner.score >= 80 ? "success" : "warning"} dot>
                    Score {banner.score}
                  </Badge>
                )}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {meta.map((m) => (
                  <div key={m.label}>
                    <dt className="text-[11px] uppercase tracking-widest text-muted">
                      {m.label}
                    </dt>
                    <dd className="mt-0.5 text-foreground">{m.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            {/* Actions */}
            <Card elevated className="p-5">
              <h3 className="text-sm font-semibold tracking-tight">Actions</h3>
              <div className="mt-3 space-y-2">
                {/* Primary: editor and builder. Stack on narrow phones,
                    side-by-side on slightly wider screens. */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    href={`/dashboard/banners/${banner.id}/edit`}
                    variant="primary"
                    leftIcon={<Edit3 className="h-3.5 w-3.5" />}
                  >
                    Edit fields
                  </Button>
                  <Button
                    href={`/dashboard/builder/${banner.id}`}
                    variant="secondary"
                    leftIcon={<PenTool className="h-3.5 w-3.5" />}
                  >
                    Open in builder
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <DownloadMenu
                    banner={banner}
                    className="w-full"
                    buttonClassName="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 text-xs font-medium text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
                  />
                  <Button
                    variant="secondary"
                    leftIcon={<Share2 className="h-3.5 w-3.5" />}
                  >
                    Share
                  </Button>
                </div>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setRegenerateOpen(true)}
                  leftIcon={<RefreshCcw className="h-3.5 w-3.5" />}
                >
                  Regenerate with new prompt
                </Button>

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

      <RegenerateDialog
        banner={banner}
        open={regenerateOpen}
        onClose={() => setRegenerateOpen(false)}
      />

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