// src/components/admin/ModelFormModal.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, Link2, Loader2, Save } from "lucide-react";
import { PROVIDER_ENDPOINTS, PROVIDERS } from "@/lib/models";
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
  customProvider: "",
  modelId: "",
  enabled: true,
  isDefault: false,
  sortOrder: 0,
  previewGradient: "from-violet-500/40 via-fuchsia-500/20 to-indigo-700/40",
  apiKey: "",
  endpoint: "",
  configExtra: "", // JSON, sans apiKey & endpoint
};

// Split an existing config blob into the dedicated fields + the rest.
function fromModel(m) {
  if (!m) return EMPTY;
  const cfg     = m.config || {};
  const apiKey  = cfg.apiKey   || cfg.api_key  || "";
  const endpoint = cfg.endpoint || cfg.baseUrl || cfg.url || "";
  const rest    = { ...cfg };
  delete rest.apiKey;
  delete rest.api_key;
  delete rest.endpoint;
  delete rest.baseUrl;
  delete rest.url;

  // If the provider isn't in the predefined list, treat it as a custom
  // provider — admins can register any OpenAI-compatible service.
  const known          = PROVIDERS.includes(m.provider);
  const provider       = known ? m.provider : "custom";
  const customProvider = known ? "" : (m.provider || "");

  return {
    slug:            m.slug || "",
    label:           m.label || "",
    kind:            m.kind || "image",
    provider,
    customProvider,
    modelId:         m.modelId || "",
    enabled:         m.enabled !== false,
    isDefault:       !!m.isDefault,
    sortOrder:       m.sortOrder ?? 0,
    previewGradient: m.previewGradient || "",
    apiKey,
    endpoint,
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
      // schedule to avoid synchronous setState in effect
      Promise.resolve().then(() => {
        setForm(fromModel(model));
        setShowKey(false);
        setError(null);
      });
    }
  }, [open, model]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Merge dedicated fields + free-form extras into a single config blob.
      let extras = {};
      if (form.configExtra?.trim()) {
        try {
          extras = JSON.parse(form.configExtra);
        } catch {
          throw new Error("Extra config must be valid JSON (or leave it empty).");
        }
      }
      const config = { ...extras };
      if (form.apiKey.trim())   config.apiKey   = form.apiKey.trim();
      if (form.endpoint.trim()) config.endpoint = form.endpoint.trim();

      // Resolve provider: "custom" lets the admin name an arbitrary provider.
      const resolvedProvider =
        form.provider === "custom"
          ? (form.customProvider.trim() || "custom")
          : form.provider;

      // Non-OpenRouter providers must have an endpoint URL — otherwise the
      // model has no way to know where to send requests.
      if (
        form.kind === "text" &&
        resolvedProvider !== "openrouter" &&
        !form.endpoint.trim()
      ) {
        throw new Error(
          `Provider "${resolvedProvider}" needs an endpoint URL. Set it above.`,
        );
      }

      await onSubmit({
        slug:      form.slug.trim(),
        label:     form.label.trim(),
        kind:      form.kind,
        provider:  resolvedProvider,
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

  const hasExistingKey =
    !!(model?.config?.apiKey || model?.config?.api_key);
  const endpointPlaceholder = useMemo(
    () =>
      PROVIDER_ENDPOINTS[form.provider] ||
      "https://api.example.com/v1/chat/completions",
    [form.provider],
  );

  const useCustomProvider = form.provider === "custom";

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="lg"
      title={model ? "Edit model" : "Add model"}
      description={
        model
          ? `Editing ${model.label}`
          : "Register a new model in the catalog. API key + endpoint are stored on this row — admins manage them here."
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
                <option key={o.value} value={o.value}>{o.label}</option>
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
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
            {useCustomProvider && (
              <Input
                value={form.customProvider}
                onChange={(e) => set({ customProvider: e.target.value })}
                placeholder="my-internal-llm"
                className="font-mono text-xs"
              />
            )}
            {form.kind === "text" && form.provider !== "openrouter" && !form.endpoint && (
              <p className="text-[11px] text-amber-400/90">
                Set the endpoint URL below so this provider can be called.
              </p>
            )}
            <p className="text-[11px] text-muted">
              Any OpenAI-compatible service works — admin sets key + URL,
              toggle enabled to switch providers on/off.
            </p>
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
                : form.provider === "openai"
                ? "gpt-4o"
                : "stability-ai/sdxl"
            }
            required
          />
          <p className="text-[11px] text-muted">
            {form.provider === "openrouter" ? (
              <>
                Format: <code className="font-mono">&lt;vendor&gt;/&lt;slug&gt;</code> (e.g.{" "}
                <code className="font-mono">anthropic/claude-3.5-sonnet</code>,{" "}
                <code className="font-mono">openai/gpt-4o</code>). Don&apos;t prefix
                with <code className="font-mono">openrouter/</code> — OpenRouter
                rejects that.
              </>
            ) : form.provider === "openai" ? (
              <>
                Format: bare slug (e.g. <code className="font-mono">gpt-4o</code>,{" "}
                <code className="font-mono">gpt-4o-mini</code>). The{" "}
                <code className="font-mono">openai/</code> vendor prefix is stripped automatically.
              </>
            ) : (
              <>Identifier used by the provider&apos;s API.</>
            )}
          </p>
        </div>

        {/* Endpoint URL — admin-configurable */}
        <div className="space-y-2">
          <Label htmlFor="endpoint" className="flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            Endpoint URL
            <span className="text-muted normal-case tracking-normal">(optional)</span>
          </Label>
          <Input
            id="endpoint"
            value={form.endpoint}
            onChange={(e) => set({ endpoint: e.target.value })}
            placeholder={endpointPlaceholder}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted">
            Leave blank to use the built-in OpenRouter endpoint. Set explicitly
            for OpenAI-compatible providers (Groq, Together, vLLM, custom proxies, etc).
          </p>
        </div>

        {/* API Key */}
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
            Stored on this model row. Leave blank when editing to keep the existing key.
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
            placeholder={`{\n  "temperature": 0.8,\n  "maxTokens": 6000\n}`}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted">
            API key and endpoint are managed in their own fields above and merged on save.
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