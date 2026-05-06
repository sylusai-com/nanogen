// src/app/admin/prompt/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
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

const SECTION_LABELS = {
  banner: "Banner generation",
  score:  "Banner scoring",
};

export default function AdminPromptPage() {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState(null); // { [key]: { value, defaultValue, ... } }
  const [drafts,  setDrafts]  = useState({});   // { [key]: string | object }
  const [busyKey, setBusyKey] = useState(null); // saving one prompt at a time
  const [error,   setError]   = useState(null);
  const [okMsg,   setOk]      = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      try {
        const j = await adminFetch("/api/admin/prompt");
        if (!active) return;
        setPrompts(j.prompts);
        const initial = {};
        for (const [k, p] of Object.entries(j.prompts)) initial[k] = cloneValue(p.value);
        setDrafts(initial);
      } catch (e) {
        if (!active) return;
        setError(e.message || "Failed to load prompts");
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  const grouped = useMemo(() => groupBySection(prompts), [prompts]);

  const onSave = async (key) => {
    const meta = prompts[key];
    if (!meta) return;
    setBusyKey(key);
    setError(null);
    setOk(null);
    try {
      const j = await adminFetch("/api/admin/prompt", {
        method: "PUT",
        body: JSON.stringify({ key, value: drafts[key] }),
      });
      setPrompts((prev) => ({
        ...prev,
        [key]: { ...prev[key], value: cloneValue(drafts[key]), isCustomized: true, updatedAt: j.updatedAt, updatedBy: j.updatedBy },
      }));
      setOk(`Saved “${meta.label}”. Future calls will use this prompt.`);
    } catch (e) {
      setError(e.message || `Failed to save ${meta.label}`);
    } finally {
      setBusyKey(null);
    }
  };

  const onDiscard = (key) => {
    setDrafts((prev) => ({ ...prev, [key]: cloneValue(prompts[key].value) }));
    setOk(null);
    setError(null);
  };

  const onLoadDefault = (key) => {
    setDrafts((prev) => ({ ...prev, [key]: cloneValue(prompts[key].defaultValue) }));
  };

  const onDeleteOverride = async (key) => {
    const meta = prompts[key];
    if (!meta) return;
    if (!confirm(`Delete the saved override for “${meta.label}” and revert to the built-in default?`)) return;
    setBusyKey(key);
    setError(null);
    setOk(null);
    try {
      const j = await adminFetch("/api/admin/prompt", {
        method: "DELETE",
        body: JSON.stringify({ key }),
      });
      setPrompts((prev) => ({
        ...prev,
        [key]: { ...prev[key], value: j.value, isCustomized: false, updatedAt: null, updatedBy: null },
      }));
      setDrafts((prev) => ({ ...prev, [key]: cloneValue(j.value) }));
      setOk(`Reverted “${meta.label}” to the built-in default.`);
    } catch (e) {
      setError(e.message || `Failed to revert ${meta.label}`);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <>
      <TopBar title="Prompts" action={null} />
      <div className="mx-auto w-full max-w-5xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <header>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              System prompts
            </h1>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Every prompt the LLM sees lives here — banner-generation system
            prompt, the user-message scaffold, per-aspect briefings, and the
            scoring prompts. Saving overrides any future call without a
            redeploy. The same module that powers this page is what banner
            generation and scoring read from at runtime, so the UI and the
            engine never drift.
          </p>
        </header>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">{error}</div>
          </div>
        )}
        {okMsg && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">{okMsg}</div>
          </div>
        )}

        {!prompts ? (
          <div className="space-y-4">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          Object.entries(grouped).map(([section, list]) => (
            <section key={section} className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
                {SECTION_LABELS[section] || section}
              </h2>
              {list.map((meta) => (
                <PromptCard
                  key={meta.key}
                  meta={meta}
                  draft={drafts[meta.key]}
                  onChange={(v) => setDrafts((prev) => ({ ...prev, [meta.key]: v }))}
                  saving={busyKey === meta.key}
                  isDirty={!isEqual(drafts[meta.key], meta.value)}
                  onSave={() => onSave(meta.key)}
                  onDiscard={() => onDiscard(meta.key)}
                  onLoadDefault={() => onLoadDefault(meta.key)}
                  onDeleteOverride={() => onDeleteOverride(meta.key)}
                />
              ))}
            </section>
          ))
        )}
      </div>
    </>
  );
}

function PromptCard({
  meta,
  draft,
  onChange,
  saving,
  isDirty,
  onSave,
  onDiscard,
  onLoadDefault,
  onDeleteOverride,
}) {
  const [showDefault, setShowDefault] = useState(false);

  return (
    <Card elevated className="space-y-4 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight">{meta.label}</h3>
            {meta.isCustomized && <Badge tone="primary">Custom</Badge>}
          </div>
          <p className="mt-1 max-w-2xl text-xs text-muted">{meta.description}</p>
          {meta.placeholders.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {meta.placeholders.map((p) => (
                <code
                  key={p}
                  className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-strong"
                >{`{${p}}`}</code>
              ))}
            </div>
          )}
        </div>
        <div className="text-right text-[11px] text-muted">
          {meta.updatedAt
            ? <>Updated {new Date(meta.updatedAt).toLocaleString()}</>
            : <>Built-in default</>}
        </div>
      </header>

      {meta.kind === "string" && (
        <StringEditor value={draft || ""} onChange={onChange} />
      )}
      {meta.kind === "json" && (
        <JsonMapEditor value={draft || {}} onChange={onChange} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={onSave}
            disabled={!isDirty || saving}
            leftIcon={saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onDiscard}
            disabled={!isDirty || saving}
            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
          >
            Discard
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onLoadDefault} disabled={saving}>
            Load default
          </Button>
          {meta.isCustomized && (
            <Button variant="ghost" size="sm" onClick={onDeleteOverride} disabled={saving}>
              Delete override
            </Button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowDefault((s) => !s)}
        className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-foreground"
      >
        {showDefault ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {showDefault ? "Hide" : "Show"} built-in default
      </button>
      {showDefault && (
        <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-muted-strong whitespace-pre-wrap">
          {meta.kind === "json"
            ? JSON.stringify(meta.defaultValue, null, 2)
            : String(meta.defaultValue)}
        </pre>
      )}
    </Card>
  );
}

function StringEditor({ value, onChange }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      rows={Math.min(28, Math.max(8, (value.match(/\n/g)?.length || 0) + 4))}
      className="w-full resize-y rounded-xl border border-border bg-background p-4 font-mono text-[12px] leading-relaxed text-foreground outline-none transition-shadow focus:border-border-strong focus:ring-2 focus:ring-ring"
    />
  );
}

// JSON-map editor — one textarea per key, with an add/remove row UI for
// adding new aspect ratios. Used for bannerAspectGuidance which is a
// `{ "16:9": "...", ..., "fallback": "..." }` map.
function JsonMapEditor({ value, onChange }) {
  const entries = Object.entries(value || {});
  const [newKey, setNewKey] = useState("");

  const setEntry = (k, v) => onChange({ ...value, [k]: v });
  const removeEntry = (k) => {
    const next = { ...value };
    delete next[k];
    onChange(next);
  };
  const addEntry = () => {
    const k = newKey.trim();
    if (!k || k in (value || {})) return;
    setNewKey("");
    onChange({ ...value, [k]: "" });
  };

  return (
    <div className="space-y-3">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-xl border border-border bg-background/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <code className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-foreground">
              {k}
            </code>
            <button
              type="button"
              onClick={() => removeEntry(k)}
              className="text-[11px] text-muted hover:text-red-400"
            >
              Remove
            </button>
          </div>
          <textarea
            value={typeof v === "string" ? v : JSON.stringify(v, null, 2)}
            onChange={(e) => setEntry(k, e.target.value)}
            spellCheck={false}
            rows={Math.min(10, Math.max(3, (String(v).match(/\n/g)?.length || 0) + 2))}
            className="w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground outline-none transition-shadow focus:border-border-strong focus:ring-2 focus:ring-ring"
          />
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="Add aspect ratio (e.g. 21:9)"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-border-strong focus:ring-2 focus:ring-ring"
        />
        <Button variant="secondary" size="sm" onClick={addEntry} disabled={!newKey.trim()}>
          Add entry
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// helpers

function cloneValue(v) {
  if (v == null) return v;
  if (typeof v === "string") return v;
  return JSON.parse(JSON.stringify(v));
}

function isEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === "string") return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

function groupBySection(prompts) {
  if (!prompts) return {};
  const out = {};
  for (const [key, meta] of Object.entries(prompts)) {
    const section = meta.section || "other";
    if (!out[section]) out[section] = [];
    out[section].push({ ...meta, key });
  }
  return out;
}

