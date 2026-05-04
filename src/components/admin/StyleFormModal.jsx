// src/components/admin/StyleFormModal.jsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import { Input, Label, Textarea } from "@/components/ui/Input";

const EMPTY = {
  slug: "",
  label: "",
  bg: "#0c0c10",
  fg: "#ffffff",
  accent: "#a78bfa",
  gradient: "",
  description: "",
  enabled: true,
  sortOrder: 0,
};

function fromItem(item) {
  if (!item) return EMPTY;
  return {
    slug: item.slug || "",
    label: item.label || "",
    bg: item.bg || "#0c0c10",
    fg: item.fg || "#ffffff",
    accent: item.accent || "#a78bfa",
    gradient: item.gradient || "",
    description: item.description || "",
    enabled: item.enabled !== false,
    sortOrder: item.sortOrder ?? 0,
  };
}

function ColorInput({ id, label, value, onChange }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 font-mono"
        />
      </div>
    </div>
  );
}

export default function StyleFormModal({ open, onClose, onSubmit, item = null }) {
  const [form, setForm]             = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  useEffect(() => {
    if (open) {
      // schedule state updates to avoid synchronous setState in effect
      Promise.resolve().then(() => {
        setForm(fromItem(item));
        setError(null);
      });
    }
  }, [open, item]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.slug.trim() || !form.label.trim()) {
      setError("Slug and label are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        slug: form.slug.trim(),
        label: form.label.trim(),
        bg: form.bg,
        fg: form.fg,
        accent: form.accent,
        gradient: form.gradient.trim() || null,
        description: form.description.trim() || null,
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

  // Live gradient preview
  const previewBg = form.gradient || form.bg;

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="lg"
      title={item ? "Edit banner style" : "Add banner style"}
      description={
        item
          ? `Editing ${item.label}`
          : "Create a new style preset for the banner generator."
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
            {submitting ? "Saving" : item ? "Save changes" : "Create style"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Gradient preview strip */}
        <div
          className="h-16 w-full rounded-xl border border-border transition-all duration-300"
          style={{ background: previewBg }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sty-slug">Slug</Label>
            <Input
              id="sty-slug"
              value={form.slug}
              onChange={(e) =>
                set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
              }
              placeholder="cyberpunk"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sty-label">Display name</Label>
            <Input
              id="sty-label"
              value={form.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder="Cyberpunk"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <ColorInput
            id="sty-bg"
            label="Background (--bg)"
            value={form.bg}
            onChange={(v) => set({ bg: v })}
          />
          <ColorInput
            id="sty-fg"
            label="Text (--fg)"
            value={form.fg}
            onChange={(v) => set({ fg: v })}
          />
          <ColorInput
            id="sty-accent"
            label="Accent (--accent)"
            value={form.accent}
            onChange={(v) => set({ accent: v })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sty-gradient">Gradient (CSS value)</Label>
          <Input
            id="sty-gradient"
            value={form.gradient}
            onChange={(e) => set({ gradient: e.target.value })}
            placeholder="linear-gradient(135deg, #0a0019 0%, #4c1d95 50%, #ec4899 100%)"
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted">
            Used as the thumbnail gradient for unsaved banners. Leave blank to use the bg color.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sty-desc">
            Description{" "}
            <span className="text-muted normal-case tracking-normal">(optional)</span>
          </Label>
          <Textarea
            id="sty-desc"
            rows={2}
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Dark, high-contrast neon aesthetic."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sty-sort">Sort order</Label>
            <Input
              id="sty-sort"
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