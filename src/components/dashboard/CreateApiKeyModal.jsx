"use client";

import { useState } from "react";
import { Copy, Check, AlertTriangle, Plus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

export default function CreateApiKeyModal({ open, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [createdKey, setCreatedKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Untitled key", scopes: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create key");
      setCreatedKey(data.key);
      onCreated?.(data.key);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (createdKey?.key) {
      navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleClose = () => {
    setName("");
    setCreatedKey(null);
    setError(null);
    setCopied(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={createdKey ? "API Key Created" : "Create API Key"}>
      {createdKey ? (
        <div className="space-y-5">
          {/* Warning */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-xs text-amber-200/80 leading-relaxed">
              <strong className="text-amber-300">Copy your API key now.</strong> This is
              the only time it will be displayed. You won't be able to see it
              again after closing this dialog.
            </div>
          </div>

          {/* Key display */}
          <div className="space-y-2">
            <Label>Your API Key</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-xs text-foreground break-all select-all">
                {createdKey.key}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Key info */}
          <div className="rounded-xl border border-border bg-surface-2 p-4 text-xs text-muted space-y-1.5">
            <div className="flex justify-between">
              <span>Name</span>
              <span className="text-foreground">{createdKey.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Rate limit</span>
              <span className="text-foreground">
                {createdKey.rate_limit_rpm} req/min · {createdKey.rate_limit_rpd?.toLocaleString()} req/day
              </span>
            </div>
            <div className="flex justify-between">
              <span>Scopes</span>
              <span className="text-foreground">
                {createdKey.scopes?.length ? createdKey.scopes.join(", ") : "All models"}
              </span>
            </div>
          </div>

          <Button onClick={handleClose} className="w-full" variant="secondary">
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="key-name">Key name</Label>
            <Input
              id="key-name"
              placeholder="e.g., My App, Production, Testing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
            <p className="text-[11px] text-muted">
              A friendly name to help you identify this key later.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleClose} variant="secondary" className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={loading}
              className="flex-1"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              {loading ? "Creating…" : "Create key"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
