// src/app/admin/models/page.js
"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Edit3,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import Skeleton from "@/components/ui/Skeleton";
import EmptyData from "@/components/ui/EmptyData";
import ModelFormModal from "@/components/admin/ModelFormModal";
import { invalidateTags } from "@/lib/cache";
import Pagination from "@/components/ui/Pagination";

const PAGE_SIZE = 8;

// All mutations go through admin-only API routes (server-side merge for
// API key preservation) — never the browser supabase client. The DB is
// still the source of truth, but the browser never sees the raw apiKey.
async function adminFetch(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

function bar(percent, color) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, percent)}%`, background: color }}
      />
    </div>
  );
}

// The admin API replaces apiKey with a `hasApiKey` boolean — the raw
// secret never leaves the server.
function hasApiKey(model) {
  return !!model?.hasApiKey;
}

export default function AdminModels() {
  const { user } = useAuth();
  const [models, setModels] = useState(null);
  const [share, setShare]   = useState({});
  const [error, setError]   = useState(null);
  const [modal, setModal]   = useState({ open: false, model: null });
  const [busyId, setBusyId] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  const reload = async (nextPage = page) => {
    try {
      // Admin route returns models with full (apiKey-redacted) config so
      // the form can pre-fill endpoint + extras. The plain
      // listAllModels() public selector intentionally hides config.
      const rows = await fetch(`/api/admin/models?page=${nextPage}&pageSize=${PAGE_SIZE}`, {
        cache: "no-store",
        credentials: "same-origin",
      })
        .then((r) => {
          if (!r.ok) throw new Error(`Models load failed (${r.status})`);
          return r.json();
        })
        .then((j) => ({
          models: j.models || [],
          totalPages: j.totalPages || 1,
          total: j.total || 0,
        }));
      setModels(rows.models);
      setTotalPages(rows.totalPages);
      setTotalRows(rows.total);
      
      // Fetch model stats from the API
      const statsRes = await fetch("/api/admin/models/stats", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        setShare(statsJson.stats || {});
      }
    } catch (e) {
      setError(e.message || "Failed to load models");
    }
  };

  // Stable user.id key avoids re-firing reload() every time the auth
  // provider re-shapes the user object (token refresh on tab switch).
  useEffect(() => {
    if (user?.id) reload(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, page]);

  const onCreate = async (form) => {
    await adminFetch("/api/admin/models", {
      method: "POST",
      body: JSON.stringify(form),
    });
    invalidateTags(["models"]);
    await reload();
  };

  const onUpdate = async (form) => {
    if (!modal.model?.id) return;
    // When the admin leaves the apiKey field blank, send the
    // __preserveApiKey sentinel so the server-side merge keeps the
    // existing key. Without this, blanking the form would wipe it.
    const patch = !form.config?.apiKey
      ? { ...form, config: { ...form.config, __preserveApiKey: true } }
      : form;
    await adminFetch(`/api/admin/models/${modal.model.id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
    invalidateTags(["models"]);
    await reload();
  };

  const onToggleEnabled = async (m) => {
    setBusyId(m.id);
    try {
      await adminFetch(`/api/admin/models/${m.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !m.enabled }),
      });
      invalidateTags(["models"]);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const onMakeDefault = async (m) => {
    setBusyId(m.id);
    try {
      await adminFetch(`/api/admin/models/${m.id}`, {
        method: "PUT",
        body: JSON.stringify({ isDefault: true }),
      });
      invalidateTags(["models"]);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (m) => {
    if (!confirm(`Delete ${m.label}? This cannot be undone.`)) return;
    setBusyId(m.id);
    try {
      await adminFetch(`/api/admin/models/${m.id}`, { method: "DELETE" });
      invalidateTags(["models"]);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const imageModels = (models || []).filter((m) => m.kind === "image");
  const textModels  = (models || []).filter((m) => m.kind === "text");

  return (
    <>
      <TopBar
        title="Models"
        action={
          <Button
            leftIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
            onClick={() => setModal({ open: true, model: null })}
          >
            New model
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-7xl space-y-8 px-5 py-8 md:px-8 md:py-10">
        <header>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Model registry
          </h1>
          <p className="mt-1 text-sm text-muted">
            Image models drive generation. Text models drive the HTML banner
            generator. API keys are stored per model — set them when adding
            or editing a model below.
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {!models ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        ) : (
          <>
            <ModelGroup
              kind="image"
              title="Image models"
              subtitle="Used by /api/generate when a user creates a banner."
              models={imageModels}
              share={share}
              busyId={busyId}
              onEdit={(m) => setModal({ open: true, model: m })}
              onToggleEnabled={onToggleEnabled}
              onDelete={onDelete}
            />
            <ModelGroup
              kind="text"
              title="Text models (HTML generator)"
              subtitle="Drive /api/banners and /api/banners/html. Mark one as default."
              models={textModels}
              share={share}
              busyId={busyId}
              onEdit={(m) => setModal({ open: true, model: m })}
              onToggleEnabled={onToggleEnabled}
              onMakeDefault={onMakeDefault}
              onDelete={onDelete}
            />
          </>
        )}

        {models && totalRows > 0 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </div>

      <ModelFormModal
        open={modal.open}
        model={modal.model}
        onClose={() => setModal({ open: false, model: null })}
        onSubmit={modal.model ? onUpdate : onCreate}
      />
    </>
  );
}

function ModelGroup({
  kind,
  title,
  subtitle,
  models,
  share,
  busyId,
  onEdit,
  onToggleEnabled,
  onMakeDefault,
  onDelete,
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <p className="text-[11px] text-muted">{subtitle}</p>
      </div>

      {models.length === 0 ? (
        <EmptyData
          icon={<Cpu className="h-5 w-5" />}
          title={`No ${kind} models yet`}
          body="Add one to get started."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {models.map((m) => {
            const live   = share[m.slug];
            const keySet = hasApiKey(m);
            return (
              <Card elevated key={m.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] text-primary ring-1 ring-inset ring-[color-mix(in_oklab,var(--primary)_25%,transparent)]">
                      <Cpu className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold tracking-tight truncate">
                          {m.label}
                        </span>
                        {m.isDefault && (
                          <Badge tone="primary">
                            <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Default
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted">
                        <code className="font-mono">{m.slug}</code> ·{" "}
                        {m.provider}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={m.enabled}
                      disabled={busyId === m.id}
                      onChange={() => onToggleEnabled(m)}
                      ariaLabel="Toggle enabled"
                    />
                  </div>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-muted">
                      Provider model
                    </dt>
                    <dd className="mt-1 truncate font-mono text-foreground">
                      {m.modelId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-muted">
                      API key
                    </dt>
                    <dd className="mt-1 inline-flex items-center gap-1.5 text-foreground">
                      {keySet ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400">Configured</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3 text-amber-400" />
                          <span className="text-amber-400">Not set</span>
                        </>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-muted">
                      Runs
                    </dt>
                    <dd className="mt-1 font-mono text-foreground">
                      {live?.runs?.toLocaleString() ?? 0}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-muted">
                      Avg score / P50
                    </dt>
                    <dd className="mt-1 font-mono text-foreground">
                      {live?.avgScore ?? "—"} ·{" "}
                      {live?.p50ms ? `${(live.p50ms / 1000).toFixed(2)}s` : "—"}
                    </dd>
                  </div>
                </dl>

                {kind === "image" && (
                  <div className="mt-5">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
                      <span>Share of traffic</span>
                      <span className="font-mono">
                        {((live?.share ?? 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    {bar((live?.share ?? 0) * 100, "var(--primary)")}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
                  <div className="flex items-center gap-2">
                    {kind === "text" && !m.isDefault && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busyId === m.id || !m.enabled}
                        onClick={() => onMakeDefault(m)}
                      >
                        Make default
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(m)}
                      disabled={busyId === m.id}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] text-muted-strong hover:bg-surface-2 hover:text-foreground transition-colors"
                    >
                      <Edit3 className="h-3 w-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(m)}
                      disabled={busyId === m.id}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}