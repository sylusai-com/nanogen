// src/components/admin/AspectFormModal.jsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import { Input, Label } from "@/components/ui/Input";

const EMPTY = {
  slug: "",
  label: "",
  ratio: "",
  enabled: true,
  sortOrder: 0,
};

function fromItem(item) {
  if (!item) return EMPTY;
  return {
    slug: item.slug || "",
    label: item.label || "",
    ratio: item.ratio || "",
    enabled: item.enabled !== false,
    sortOrder: item.sortOrder ?? 0,
  };
}

export default function AspectFormModal({ open, onClose, onSubmit, item = null }) {
  const [form, setForm]           = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  useEffect(() => {
    if (open) {
      setForm(fromItem(item));
      setError(null);
    }
  }, [open, item]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.slug.trim() || !form.label.trim() || !form.ratio.trim()) {
      setError("Slug, label, and ratio are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        slug: form.slug.trim(),
        label: form.label.trim(),
        ratio: form.ratio.trim(),
        enabled: form.enabled,
        sortOrder: Number(form.sortOrder) || 0,
      });
      onClose?.();
    } catch (e) {
      setError(e.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="md"
      title={item ? "Edit aspect ratio" : "Add aspect ratio"}
      description={
        item
          ? `Editing ${item.label}`
          : "Add a new aspect ratio to the catalog."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            leftIcon={
              submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )
            }
          >
            {submitting ? "Saving" : item ? "Save changes" : "Create ratio"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="asp-slug">Slug</Label>
            <Input
              id="asp-slug"
              value={form.slug}
              onChange={(e) =>
                set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
              }
              placeholder="16-9"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asp-ratio">Ratio</Label>
            <Input
              id="asp-ratio"
              value={form.ratio}
              onChange={(e) => set({ ratio: e.target.value.trim() })}
              placeholder="16:9"
              required
            />
            <p className="text-[11px] text-muted">
              Format: <code className="font-mono">W:H</code> e.g. 16:9, 1:1, 4:5
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="asp-label">Display label</Label>
          <Input
            id="asp-label"
            value={form.label}
            onChange={(e) => set({ label: e.target.value })}
            placeholder="Landscape · 16:9"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="asp-sort">Sort order</Label>
            <Input
              id="asp-sort"
              type="number"
              value={form.sortOrder}
              onChange={(e) => set({ sortOrder: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3.5">
              <Switch checked={form.enabled} onChange={(v) => set({ enabled: v })} />
              <span className="text-sm text-foreground">Enabled</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}