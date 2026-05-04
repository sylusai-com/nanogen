// src/app/dashboard/banners/[id]/edit/page.js
"use client";

import { use, useEffect, useState, useRef, startTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, RefreshCw, Save } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Button from "@/components/ui/Button";
import EmptyData from "@/components/ui/EmptyData";
import EditorPreview from "@/components/editor/EditorPreview";
import EditorPanel from "@/components/editor/EditorPanel";
import DownloadMenu from "@/components/banner/DownloadMenu";
import { getBanner, updateBanner } from "@/lib/db/banners";

function aspectClass(a) {
  if (a === "1:1")  return "aspect-square";
  if (a === "4:5")  return "aspect-[4/5]";
  if (a === "9:16") return "aspect-[9/16]";
  return "aspect-[16/9]";
}

function EditorPreviewSkeleton({ aspect = "16:9" }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-2 p-3 h-full">
      <div className={`relative w-full h-full overflow-hidden rounded-xl bg-surface ${aspectClass(aspect)}`}>
        <div className="skeleton absolute inset-0" />
        <div className="absolute inset-0 flex flex-col items-start justify-end gap-3 p-6 md:p-10">
          <div className="h-3 w-24 rounded-full bg-foreground/10" />
          <div className="h-10 w-3/4 rounded-md bg-foreground/15" />
          <div className="h-10 w-1/2 rounded-md bg-foreground/15" />
          <div className="h-3 w-2/3 rounded-full bg-foreground/8" />
          <div className="mt-2 flex gap-2">
            <div className="h-9 w-32 rounded-full bg-foreground/15" />
            <div className="h-9 w-24 rounded-full bg-foreground/8" />
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
        <Loader2 className="h-3 w-3 animate-spin" />
        Generating HTML banner template — usually 15–45 seconds…
      </div>
    </div>
  );
}

export default function BannerEditor({ params }) {
  const { id } = use(params);
  const { user, supabase } = useAuth();

  const [banner, setBanner] = useState(null);
  const [template, setTemplate] = useState(null);
  const [fields, setFields] = useState([]);
  const [alignment, setAlignment] = useState("left");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const justSavedTimer = useRef(null);
  const [error, setError] = useState(null);

  // 1. Load banner from DB. We depend on user?.id (stable) instead of
  //    `user` (a new object reference on every profile re-fetch) so
  //    tab-switching doesn't reload the banner / re-call the model.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    startTransition(() => setLoading(true));
    getBanner(supabase, id)
      .then((b) => {
        if (cancelled) return;
        startTransition(() => setBanner(b));
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && startTransition(() => setLoading(false)));
    return () => {
      cancelled = true;
    };
  }, [id, userId, supabase]);

  // 2. Hydrate the editor: use stored html/css/fields if present, otherwise
  //    request a fresh template from /api/banners/html. Keyed on
  //    banner?.id so saves (which create a new banner object) don't
  //    re-trigger the call.
  const bannerId = banner?.id;
  useEffect(() => {
    if (!banner) return;
    if (banner.html && banner.css && Array.isArray(banner.fields)) {
      startTransition(() => {
        setTemplate({ html: banner.html, css: banner.css });
        setFields(banner.fields);
        setAlignment(banner.alignment || "left");
      });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/banners/html", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: banner.prompt || banner.title,
            style: banner.style,
            aspect: banner.aspect,
          }),
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        startTransition(() => {
          setTemplate({ html: data.html, css: data.css });
          setFields(data.fields);
          setAlignment(data.alignment || "left");
        });
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load template");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannerId]);

  const onFieldChange = (fieldId, value) => {
    setFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, value } : f)));
    setSavedAt(null);
  };
  const onAlignmentChange = (a) => {
    setAlignment(a);
    setSavedAt(null);
  };

  const onSave = async () => {
    if (!banner || !template) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateBanner(supabase, banner.id, {
        html: template.html,
        css: template.css,
        fields,
        alignment,
      });
      if (updated) setBanner(updated);
      const now = Date.now();
      setSavedAt(now);
      // toggle justSaved for UI feedback without calling Date.now in render
      if (justSavedTimer.current) clearTimeout(justSavedTimer.current);
      setJustSaved(true);
      justSavedTimer.current = setTimeout(() => setJustSaved(false), 1500);
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <TopBar />
        <div className="px-5 py-10 text-sm text-muted">
          <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />
          Loading editor…
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

  // `justSaved` is now stateful to avoid impure Date.now calls during render.

  return (
    <>
      <TopBar
        title="Editor"
        action={
          <div className="flex items-center gap-2">
            <DownloadMenu
              banner={{
                title:     banner.title,
                html:      template?.html,
                css:       template?.css,
                fields,
                alignment,
                aspect:    banner.aspect,
              }}
            />
            <Button
              onClick={onSave}
              disabled={saving}
              leftIcon={
                saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : justSaved ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )
              }
            >
              {saving ? "Saving" : justSaved ? "Saved" : "Save changes"}
            </Button>
          </div>
        }
      />
      <div className="mx-auto w-full max-w-7xl space-y-6 overflow-x-hidden px-5 py-6 md:px-8 md:py-8 lg:h-[calc(100vh-7rem)] lg:overflow-hidden">
        <div className="flex items-center justify-between">
          <Link
            href={`/dashboard/banners/${banner.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to banner
          </Link>
          <div className="text-xs text-muted">{banner.title}</div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
            <button
              onClick={() => setBanner({ ...banner })}
              className="ml-3 inline-flex items-center gap-1 text-xs text-red-300 underline-offset-2 hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        {/* Two-column layout. Preview is sticky and capped at viewport
            height on lg+; panel scrolls independently. On smaller screens
            preview is capped so it can't push the controls below the
            fold and overlap visually. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:h-full">
          <div className="min-w-0 lg:sticky lg:top-20 lg:self-start lg:h-full lg:overflow-y-auto lg:pr-4" style={{ scrollbarGutter: 'stable' }}>
            {!template ? (
              <EditorPreviewSkeleton aspect={banner.aspect} />
            ) : (
              <EditorPreview
                template={template}
                fields={fields}
                alignment={alignment}
                aspect={banner.aspect}
                className="h-full"
              />
            )}
          </div>
          <div className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:h-full lg:self-start lg:overflow-y-auto lg:pr-4" style={{ scrollbarGutter: 'stable' }}>
            {fields.length > 0 ? (
              <EditorPanel
                fields={fields}
                alignment={alignment}
                onFieldChange={onFieldChange}
                onAlignmentChange={onAlignmentChange}
              />
            ) : (
              <div className="rounded-2xl border border-border bg-surface p-5 text-xs text-muted">
                Loading editor…
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
