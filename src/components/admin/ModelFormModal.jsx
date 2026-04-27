"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { PROVIDER_KEY_ENV } from "@/lib/models";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import Select from "@/components/ui/Select";
import { Input, Label, Textarea } from "@/components/ui/Input";

const KIND_OPTIONS = [
  { value: "image", label: "Image (banner generation)" },
  { value: "text", label: "Text (HTML banner generator)" },
];

const PROVIDERS = Object.keys(PROVIDER_KEY_ENV);

const EMPTY = {
  slug: "",
  label: "",
  kind: "image",
  provider: "openrouter",
  modelId: "",
  enabled: true,
  isDefault: false,
  sortOrder: 0,
  previewGradient: "from-violet-500/40 via-fuchsia-500/20 to-indigo-700/40",
  config: "",
};

function fromModel(m) {
  if (!m) return EMPTY;
  return {
    slug: m.slug || "",
    label: m.label || "",
    kind: m.kind || "image",
    provider: m.provider || "openrouter",
    modelId: m.modelId || "",
    enabled: m.enabled !== false,
    isDefault: !!m.isDefault,
    sortOrder: m.sortOrder ?? 0,
    previewGradient: m.previewGradient || "",
    config: m.config ? JSON.stringify(m.config, null, 2) : "",
  };
}

export default function ModelFormModal({
  open,
  onClose,
  onSubmit,
  model = null,
}) {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(fromModel(model));
      setError(null);
    }
  }, [open, model]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      let parsedConfig = {};
      if (form.config?.trim()) {
        try {
          parsedConfig = JSON.parse(form.config);
        } catch {
          throw new Error("Config must be valid JSON (or leave it empty).");
        }
      }
      await onSubmit({
        slug: form.slug.trim(),
        label: form.label.trim(),
        kind: form.kind,
        provider: form.provider,
        modelId: form.modelId.trim(),
        enabled: form.enabled,
        isDefault: form.kind === "text" ? form.isDefault : false,
        sortOrder: Number(form.sortOrder) || 0,
        previewGradient:
          form.kind === "image" ? form.previewGradient.trim() || null : null,
        config: parsedConfig,
      });
      onClose?.();
    } catch (e) {
      setError(e.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const envVar = PROVIDER_KEY_ENV[form.provider];

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="lg"
      title={model ? "Edit model" : "Add model"}
      description={
        model
          ? `Editing ${model.label}`
          : "Register a new model in the catalog. API keys live in env vars."
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
            {submitting ? "Saving" : model ? "Save changes" : "Create model"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="kind">Kind</Label>
            <Select
              id="kind"
              value={form.kind}
              onChange={(e) => set({ kind: e.target.value })}
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select
              id="provider"
              value={form.provider}
              onChange={(e) => set({ provider: e.target.value })}
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            {envVar && (
              <p className="text-[11px] text-muted">
                API key looked up from{" "}
                <code className="font-mono text-muted-strong">{envVar}</code>
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) =>
                set({
                  slug: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-"),
                })
              }
              placeholder="claude-sonnet-3-5"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="label">Display name</Label>
            <Input
              id="label"
              value={form.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder="Claude Sonnet 3.5"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="modelId">Provider model ID</Label>
          <Input
            id="modelId"
            value={form.modelId}
            onChange={(e) => set({ modelId: e.target.value })}
            placeholder={
              form.provider === "openrouter"
                ? "anthropic/claude-3.5-sonnet"
                : "stability-ai/sdxl"
            }
            required
          />
          <p className="text-[11px] text-muted">
            Identifier used by the provider's API.
          </p>
        </div>

        {form.kind === "image" && (
          <div className="space-y-2">
            <Label htmlFor="previewGradient">Preview gradient (Tailwind)</Label>
            <Input
              id="previewGradient"
              value={form.previewGradient}
              onChange={(e) => set({ previewGradient: e.target.value })}
              placeholder="from-violet-500/40 via-fuchsia-500/20 to-indigo-700/40"
            />
            <p className="text-[11px] text-muted">
              Used as the thumbnail for unrendered outputs.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sortOrder">Sort order</Label>
            <Input
              id="sortOrder"
              type="number"
              value={form.sortOrder}
              onChange={(e) => set({ sortOrder: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <div className="flex h-10 items-center gap-4 rounded-xl border border-border bg-background px-3.5">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Switch
                  checked={form.enabled}
                  onChange={(v) => set({ enabled: v })}
                />
                Enabled
              </label>
              {form.kind === "text" && (
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Switch
                    checked={form.isDefault}
                    onChange={(v) => set({ isDefault: v })}
                  />
                  Default
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="config">
            Config <span className="text-muted normal-case tracking-normal">(optional JSON)</span>
          </Label>
          <Textarea
            id="config"
            rows={4}
            value={form.config}
            onChange={(e) => set({ config: e.target.value })}
            placeholder={`{\n  "temperature": 0.7\n}`}
            className="font-mono text-xs"
          />
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
