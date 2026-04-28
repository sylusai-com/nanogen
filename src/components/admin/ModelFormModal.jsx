// src/components/admin/ModelFormModal.jsx
"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Save } from "lucide-react";
import { PROVIDERS } from "@/lib/models";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import Select from "@/components/ui/Select";
import { Input, Label, Textarea } from "@/components/ui/Input";

const KIND_OPTIONS = [
  { value: "image", label: "Image (banner generation)" },
  { value: "text",  label: "Text (HTML banner generator)" },
];

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
  apiKey: "",
  configExtra: "", // JSON, sans apiKey
};

// Split an existing config blob into the dedicated apiKey field + the rest.
function fromModel(m) {
  if (!m) return EMPTY;
  const cfg     = m.config || {};
  const apiKey  = cfg.apiKey || cfg.api_key || "";
  const rest    = { ...cfg };
  delete rest.apiKey;
  delete rest.api_key;

  return {
    slug:            m.slug || "",
    label:           m.label || "",
    kind:            m.kind || "image",
    provider:        m.provider || "openrouter",
    modelId:         m.modelId || "",
    enabled:         m.enabled !== false,
    isDefault:       !!m.isDefault,
    sortOrder:       m.sortOrder ?? 0,
    previewGradient: m.previewGradient || "",
    apiKey,
    configExtra: Object.keys(rest).length ? JSON.stringify(rest, null, 2) : "",
  };
}

export default function ModelFormModal({
  open,
  onClose,
  onSubmit,
  model = null,
}) {
  const [form, setForm]             = useState(EMPTY);
  const [showKey, setShowKey]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  useEffect(() => {
    if (open) {
      setForm(fromModel(model));
      setShowKey(false);
      setError(null);
    }
  }, [open, model]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Merge dedicated apiKey + free-form extras into a single config blob.
      let extras = {};
      if (form.configExtra?.trim()) {
        try {
          extras = JSON.parse(form.configExtra);
        } catch {
          throw new Error("Extra config must be valid JSON (or leave it empty).");
        }
      }
      const config = { ...extras };
      if (form.apiKey.trim()) config.apiKey = form.apiKey.trim();

      await onSubmit({
        slug:      form.slug.trim(),
        label:     form.label.trim(),
        kind:      form.kind,
        provider:  form.provider,
        modelId:   form.modelId.trim(),
        enabled:   form.enabled,
        isDefault: form.kind === "text" ? form.isDefault : false,
        sortOrder: Number(form.sortOrder) || 0,
        previewGradient:
          form.kind === "image" ? form.previewGradient.trim() || null : null,
        config,
      });
      onClose?.();
    } catch (e) {
      setError(e.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Show a hint when API key is required but missing.
  const apiKeyMissing = !form.apiKey.trim() && !!model?.modelId === false; // only hint on new
  const hasExistingKey =
    !!(model?.config?.apiKey || model?.config?.api_key);

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="lg"
      title={model ? "Edit model" : "Add model"}
      description={
        model
          ? `Editing ${model.label}`
          : "Register a new model in the catalog. The API key is stored on this row — admins manage it here."
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
        {/* Kind + Provider */}
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
            {form.kind === "text" && form.provider !== "openrouter" && (
              <p className="text-[11px] text-amber-400/90">
                Only OpenRouter is wired up for HTML banner generation today.
              </p>
            )}
          </div>
        </div>

        {/* Slug + Label */}
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

        {/* Provider model ID */}
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

        {/* API Key — the new dedicated field */}
        <div className="space-y-2">
          <Label htmlFor="apiKey" className="flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" />
            API key
            {hasExistingKey && !form.apiKey && (
              <span className="ml-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-400">
                set
              </span>
            )}
          </Label>
          <div className="relative">
            <Input
              id="apiKey"
              type={showKey ? "text" : "password"}
              value={form.apiKey}
              onChange={(e) => set({ apiKey: e.target.value })}
              placeholder={
                hasExistingKey
                  ? "•••••••• (leave blank to keep current)"
                  : form.provider === "openrouter"
                  ? "sk-or-v1-…"
                  : "sk-…"
              }
              className="pr-10 font-mono text-xs"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
              tabIndex={-1}
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-[11px] text-muted">
            Stored on this model row in the database. Leave blank when editing
            to keep the existing key.
          </p>
        </div>

        {/* Image-only: thumbnail gradient */}
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

        {/* Sort order + state */}
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

        {/* Free-form extra config */}
        <div className="space-y-2">
          <Label htmlFor="configExtra">
            Extra config{" "}
            <span className="text-muted normal-case tracking-normal">
              (optional JSON — e.g. temperature, maxTokens)
            </span>
          </Label>
          <Textarea
            id="configExtra"
            rows={4}
            value={form.configExtra}
            onChange={(e) => set({ configExtra: e.target.value })}
            placeholder={`{\n  "temperature": 0.7,\n  "maxTokens": 4000\n}`}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted">
            The API key has its own field above and is merged into this on save.
          </p>
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