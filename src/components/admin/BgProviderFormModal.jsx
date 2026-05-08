// src/components/admin/BgProviderFormModal.jsx
"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Save, Link2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import Select from "@/components/ui/Select";
import { Input, Label, Textarea } from "@/components/ui/Input";

const TYPE_OPTIONS = ["unsplash", "pexels", "pixabay", "custom"];

const EMPTY = {
  name: "",
  type: "unsplash",
  apiKey: "",
  apiEndpoint: "",
  enabled: true,
  configExtra: "",
};

function fromProvider(provider) {
  if (!provider) return EMPTY;
  const cfg = provider.config || {};
  const rest = { ...cfg };
  delete rest.apiKey;
  delete rest.api_key;
  delete rest.endpoint;
  delete rest.api_endpoint;
  return {
    name: provider.name || "",
    type: provider.type || "unsplash",
    apiKey: "",
    apiEndpoint: provider.api_endpoint || cfg.endpoint || cfg.api_endpoint || "",
    enabled: provider.enabled !== false,
    configExtra: Object.keys(rest).length ? JSON.stringify(rest, null, 2) : "",
  };
}

export default function BgProviderFormModal({
  open,
  onClose,
  onSubmit,
  provider = null,
}) {
  const [form, setForm] = useState(EMPTY);
  const [showKey, setShowKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      Promise.resolve().then(() => {
        setForm(fromProvider(provider));
        setShowKey(false);
        setError(null);
      });
    }
  }, [open, provider]);

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      let extraConfig = {};
      if (form.configExtra?.trim()) {
        try {
          extraConfig = JSON.parse(form.configExtra);
        } catch {
          throw new Error("Extra config must be valid JSON.");
        }
      }

      const payload = {
        name: form.name.trim(),
        type: form.type,
        api_endpoint: form.apiEndpoint.trim(),
        enabled: form.enabled,
        config: extraConfig,
      };

      if (form.apiKey.trim()) {
        payload.api_key = form.apiKey.trim();
      } else if (!provider) {
        throw new Error("API key is required when creating a provider.");
      }

      await onSubmit(payload);
      onClose?.();
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const hasExistingKey = !!provider?.hasApiKey;
  const endpointPlaceholder =
    form.type === "unsplash"
      ? "https://api.unsplash.com/search/photos"
      : form.type === "pexels"
      ? "https://api.pexels.com/v1/search"
      : form.type === "pixabay"
      ? "https://pixabay.com/api/"
      : "https://api.example.com/search";

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="lg"
      title={provider ? "Edit BG provider" : "Add BG provider"}
      description={
        provider
          ? `Editing ${provider.name}`
          : "Register a background-image provider for banner generation. Keys stay on the server."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            leftIcon={submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          >
            {submitting ? "Saving" : provider ? "Save changes" : "Create provider"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Provider name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(event) => set({ name: event.target.value })}
              placeholder="Unsplash staging"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Provider type</Label>
            <Select id="type" value={form.type} onChange={(event) => set({ type: event.target.value })}>
              {TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiEndpoint" className="flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            API endpoint
          </Label>
          <Input
            id="apiEndpoint"
            value={form.apiEndpoint}
            onChange={(event) => set({ apiEndpoint: event.target.value })}
            placeholder={endpointPlaceholder}
            className="font-mono text-xs"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey" className="flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" />
            API key
            {hasExistingKey && !form.apiKey && (
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-400">set</span>
            )}
          </Label>
          <div className="relative">
            <Input
              id="apiKey"
              type={showKey ? "text" : "password"}
              value={form.apiKey}
              onChange={(event) => set({ apiKey: event.target.value })}
              placeholder={hasExistingKey ? "•••••••• (leave blank to keep current)" : "Paste provider key"}
              className="pr-10 font-mono text-xs"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowKey((value) => !value)}
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
              aria-label={showKey ? "Hide API key" : "Show API key"}
              tabIndex={-1}
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="configExtra">Extra config JSON</Label>
          <Textarea
            id="configExtra"
            rows={5}
            value={form.configExtra}
            onChange={(event) => set({ configExtra: event.target.value })}
            placeholder='{"per_page": 1, "orientation": "landscape"}'
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted">
            Optional provider-specific settings. Keep the API key and endpoint in the dedicated fields above.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-2 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-foreground">Enabled</div>
            <p className="text-xs text-muted">Disabled providers stay in the registry but are ignored by generation.</p>
          </div>
          <Switch checked={form.enabled} onChange={() => set({ enabled: !form.enabled })} ariaLabel="Toggle enabled" />
        </div>
      </form>
    </Modal>
  );
}