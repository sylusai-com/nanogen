"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw, Sparkles, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { useAuth } from "@/components/layout/AuthProvider";
import { invalidateTags } from "@/lib/cache";

// Modal that lets the user regenerate an existing banner with a new
// prompt while inheriting the prior banner's context (style, aspect,
// reference image, prior subject image, prior fields snapshot). The
// /api/banners route owns the regenerate semantics — this dialog just
// shapes the request and surfaces progress.
//
// The outer component only mounts the dialog body when `open` flips
// true, so local state resets cleanly between opens via the inner
// component's useState initializer (no setState-in-effect needed).
export default function RegenerateDialog({ banner, open, onClose }) {
  if (!open || !banner) return null;
  return <DialogBody banner={banner} onClose={onClose} />;
}

function DialogBody({ banner, onClose }) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [prompt, setPrompt] = useState(banner?.prompt || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const id = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          regenerateFromId: banner.id,
          // Carry the prior aspect explicitly — regenerate inherits the
          // rest from the server-side load, but we keep this here so the
          // user can still see the lineage in network logs.
          aspect: banner.aspect,
          style: banner.style || null,
          // The server will pull the prior bg_image / reference image
          // forward when these are omitted.
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);

      invalidateTags(["banners", "generation_results", `banner:${banner.id}`]);
      const next = data.banner;
      if (next?.id) {
        router.push(`/dashboard/banners/${next.id}/edit`);
      }
      onClose?.();
    } catch (err) {
      setError(err?.message || "Regeneration failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => !submitting && onClose?.()}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-primary">
              <RefreshCcw className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Regenerate banner</h3>
              <p className="text-[11px] text-muted">
                Inherits the prior style, aspect, reference image, and subject image.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="rounded-xl border border-border/70 bg-surface-2/40 p-3 text-[11px] text-muted">
            <div className="font-medium uppercase tracking-widest text-[10px] text-muted-strong">
              Inherited context
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-y-1">
              <Item label="Aspect" value={banner.aspect || "—"} />
              <Item label="Style"  value={banner.style  || "Auto"} />
              <Item label="Model"  value={banner.modelLabel || "Auto"} />
              <Item label="Reference" value={banner.referenceImageUrl ? "yes" : "—"} />
            </dl>
          </div>

          <label className="block">
            <span className="block text-[11px] font-medium uppercase tracking-widest text-muted">
              New prompt
            </span>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 1000))}
              rows={4}
              placeholder="Describe what to change — e.g. swap palette to warm earthy tones, tighten the headline, add a trust line."
              className="mt-1.5 block w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-relaxed placeholder:text-muted outline-none transition-colors focus:border-primary/60"
            />
          </label>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {isAdmin ? error : "Regeneration failed — try again in a moment."}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!prompt.trim() || submitting}
              leftIcon={
                submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )
              }
            >
              {submitting ? "Regenerating" : "Regenerate"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Item({ label, value }) {
  return (
    <>
      <dt className="text-[10px] uppercase tracking-widest text-muted">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </>
  );
}
