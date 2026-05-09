// src/components/admin/BgRemovalProviderFormModal.jsx
"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Link2, Loader2, Save } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import Select from "@/components/ui/Select";
import { Input, Label, Textarea } from "@/components/ui/Input";

const TYPE_OPTIONS = ["removebg", "clipdrop", "photoroom", "custom"];

const EMPTY = {
  name: "",
  type: "removebg",
  apiKey: "",
  apiEndpoint: "",
  enabled: true,
  configExtra: "",
};

function fromProvider(provider) {
  if (!provider) return EMPTY;
  const cfg = provider.config || {};
  return {
    name: provider.name || "",
    type: provider.type || "removebg",
    apiKey: "",
    apiEndpoint: provider.api_endpoint || "",
    enabled: provider.enabled !== false,
    configExtra: Object.keys(cfg).length ? JSON.stringify(cfg, null, 2) : "",
  };
}

function endpointPlaceholderFor(type) {
  switch (type) {
    case "removebg":
      return "https://api.remove.bg/v1.0/removebg (default — leave blank)";
    case "clipdrop":
      return "https://clipdrop-api.co/remove-background/v1 (default — leave blank)";
    case "photoroom":
      return "https://image-api.photoroom.com/v2/edit (default — leave blank)";
    default:
      return "https://your-host.example.com/remove-bg";
  }
}

export default function BgRemovalProviderFormModal({ open, onClose, onSubmit, provider = null }) {
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
        api_endpoint: form.apiEndpoint.trim() || null,
        enabled: form.enabled,
        config: extraConfig,
      };
      if (form.apiKey.trim()) {
        payload.api_key = form.apiKey.trim();
      } else if (!provider && form.type !== "custom") {
        throw new Error("API key is required for branded providers.");
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

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      size="lg"
      title={provider ? "Edit removal provider" : "Add removal provider"}
      description={
        provider
          ? `Editing ${provider.name}`
          : "Register a background-removal vendor. Keys stay on the server."
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
            <Label htmlFor="rname">Provider name</Label>
            <Input
              id="rname"
              value={form.name}
              onChange={(event) => set({ name: event.target.value })}
              placeholder="remove.bg production"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rtype">Provider type</Label>
            <Select id="rtype" value={form.type} onChange={(event) => set({ type: event.target.value })}>
              {TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rApiEndpoint" className="flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            API endpoint {form.type !== "custom" && <span className="text-[10px] text-muted">(optional)</span>}
          </Label>
          <Input
            id="rApiEndpoint"
            value={form.apiEndpoint}
            onChange={(event) => set({ apiEndpoint: event.target.value })}
            placeholder={endpointPlaceholderFor(form.type)}
            className="font-mono text-xs"
            required={form.type === "custom"}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rApiKey" className="flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" />
            API key {form.type === "custom" && <span className="text-[10px] text-muted">(optional)</span>}
            {hasExistingKey && !form.apiKey && (
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-400">set</span>
            )}
          </Label>
          <div className="relative">
            <Input
              id="rApiKey"
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
          <Label htmlFor="rConfigExtra">Extra config JSON</Label>
          <Textarea
            id="rConfigExtra"
            rows={5}
            value={form.configExtra}
            onChange={(event) => set({ configExtra: event.target.value })}
            placeholder='{"field_name": "image", "auth_header": "X-Api-Key"}'
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted">
            Custom-provider knobs: <span className="font-mono">field_name</span> (multipart field), <span className="font-mono">auth_header</span>, <span className="font-mono">auth_scheme</span>.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-2 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-foreground">Enabled</div>
            <p className="text-xs text-muted">Disabled providers stay in the registry but are skipped during generation.</p>
          </div>
          <Switch checked={form.enabled} onChange={() => set({ enabled: !form.enabled })} ariaLabel="Toggle enabled" />
        </div>
      </form>
    </Modal>
  );
}
