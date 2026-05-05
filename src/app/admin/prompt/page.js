// src/app/admin/prompt/page.js
"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";

async function adminFetch(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export default function AdminPromptPage() {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [draft, setDraft]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);
  const [okMessage, setOk]    = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      try {
        const j = await adminFetch("/api/admin/prompt");
        if (!active) return;
        setData(j);
        setDraft(j.value || "");
      } catch (e) {
        if (!active) return;
        setError(e.message || "Failed to load prompt");
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  const isDirty   = data && draft !== data.value;
  const charCount = draft.length;

  const onSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const j = await adminFetch("/api/admin/prompt", {
        method: "PUT",
        body: JSON.stringify({ value: draft }),
      });
      setData((d) => ({ ...d, ...j, isCustomized: true }));
      setOk("Prompt saved. Future banner generations will use this prompt.");
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const onResetToDefault = async () => {
    if (!data?.defaultValue) return;
    setDraft(data.defaultValue);
  };

  const onRevertChanges = () => {
    if (!data) return;
    setDraft(data.value || "");
    setOk(null);
    setError(null);
  };

  const onRestoreInCode = async () => {
    if (!confirm("Delete the saved prompt and revert to the built-in default?")) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const j = await adminFetch("/api/admin/prompt", { method: "DELETE" });
      setData((d) => ({
        ...d,
        value:        j.value,
        isCustomized: false,
        updatedAt:    null,
        updatedBy:    null,
      }));
      setDraft(j.value);
      setOk("Reverted to the built-in default prompt.");
    } catch (e) {
      setError(e.message || "Failed to revert");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar title="Banner prompt" action={null} />
      <div className="mx-auto w-full max-w-5xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <header>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              System prompt
            </h1>
            {data?.isCustomized && (
              <Badge tone="primary">Custom</Badge>
            )}
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            This is the exact system prompt sent to the LLM whenever a user
            generates a banner from the dashboard. Any change here applies to
            every subsequent generation request — the model reads the latest
            value on every call. The user&apos;s brief is appended afterward
            as a separate user message.
          </p>
        </header>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">{error}</div>
          </div>
        )}
        {okMessage && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">{okMessage}</div>
          </div>
        )}

        {!data ? (
          <Skeleton className="h-105 w-full" />
        ) : (
          <Card elevated className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] text-muted">
                {data.updatedAt ? (
                  <>Last updated {new Date(data.updatedAt).toLocaleString()}</>
                ) : (
                  <>Using the built-in default — no overrides saved yet.</>
                )}
              </div>
              <div className="font-mono text-[10px] text-muted-strong">
                {charCount.toLocaleString()} chars
              </div>
            </div>

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              rows={24}
              className="w-full resize-y rounded-xl border border-border bg-background p-4 font-mono text-[12px] leading-relaxed text-foreground outline-none transition-shadow focus:border-border-strong focus:ring-2 focus:ring-ring"
              placeholder="System prompt text…"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="md"
                  onClick={onSave}
                  disabled={!isDirty || saving}
                  leftIcon={
                    saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )
                  }
                >
                  {saving ? "Saving…" : "Save prompt"}
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={onRevertChanges}
                  disabled={!isDirty || saving}
                  leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                >
                  Discard changes
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onResetToDefault}
                  disabled={saving}
                >
                  Load built-in default
                </Button>
                {data?.isCustomized && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRestoreInCode}
                    disabled={saving}
                  >
                    Delete override
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        <Card className="p-5">
          <h3 className="text-sm font-semibold tracking-tight">
            What this prompt controls
          </h3>
          <ul className="mt-3 space-y-2 text-xs text-muted">
            <li>• The output schema (JSON shape with html / css / fields)</li>
            <li>• Output constraints (HTML + CSS only, no external image URLs)</li>
            <li>• Color, contrast, and accessibility rules</li>
            <li>• Background composition guidance (CSS gradients + inline SVG)</li>
          </ul>
          <p className="mt-3 text-[11px] text-muted">
            The user&apos;s brief, selected style, aspect ratio, and any
            variant seed are appended as a separate user message — they are
            <em> not </em> part of this system prompt.
          </p>
        </Card>
      </div>
    </>
  );
}
