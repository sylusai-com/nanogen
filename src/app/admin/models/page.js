// src/app/admin/models/page.js
"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Edit3,
  Eye,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Workflow,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import Skeleton from "@/components/ui/Skeleton";
import EmptyData from "@/components/ui/EmptyData";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ModelFormModal from "@/components/admin/ModelFormModal";
import Select from "@/components/ui/Select";
import { invalidateTags } from "@/lib/cache";
import { useApiCache } from "@/lib/useApiCache";

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
  const [error, setError]   = useState(null);
  const [modal, setModal]   = useState({ open: false, model: null });
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  // Cache model stats with 60s TTL. Invalidate when models OR
  // generation_results change so stats reflect recent runs.
  const { data: statsData } = useApiCache(
    "/api/admin/models/stats",
    { ttlMs: 60_000, tags: ["models", "generation_results"], enabled: !!user },
  );
  const share = statsData?.stats || {};

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
      // Model stats are now cached via useApiCache hook
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

  const onDelete = async () => {
    if (!deleteTarget?.id) return;
    setBusyId(deleteTarget.id);
    try {
      await adminFetch(`/api/admin/models/${deleteTarget.id}`, { method: "DELETE" });
      invalidateTags(["models"]);
      await reload();
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
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
          <div className="rounded-xl border border-danger-border bg-danger-surface px-4 py-3 text-sm text-danger-text">
            {error}
          </div>
        )}

        {/* Credit-health alert — raised by the banner generation pipeline
            when a model's provider account runs out of credits and a
            user's banner fell back to the static template. */}
        {(models || []).some((m) => m.creditStatus === "insufficient") && (
          <div className="flex items-start gap-3 rounded-xl border border-danger-border bg-danger-surface px-4 py-3 text-sm text-danger-text">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Some models are out of credits</div>
              <div className="opacity-90">
                A recent banner generation fell back to a default template because the
                provider account ran out of credits. Top up credits with the provider or
                switch the default model — affected models are flagged below.
              </div>
            </div>
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
              onDelete={setDeleteTarget}
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
              onDelete={setDeleteTarget}
            />
            <WorkflowStages />
          </>
        )}
      </div>

      <ModelFormModal
        open={modal.open}
        model={modal.model}
        onClose={() => setModal({ open: false, model: null })}
        onSubmit={modal.model ? onUpdate : onCreate}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Delete ${deleteTarget.label}?` : "Delete model?"}
        description={deleteTarget ? `This will permanently remove ${deleteTarget.label} from the model registry.` : "This will permanently remove the selected model from the registry."}
        confirmLabel="Delete model"
        loading={busyId === deleteTarget?.id}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={onDelete}
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
            // generation_results.model_id stores the provider/modelId (model.modelId),
            // so stats are keyed by `modelId` on the server. Lookup by that.
            const live   = share[m.modelId];
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

                {m.creditStatus === "insufficient" && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-danger-border bg-danger-surface px-3 py-2.5 text-[11px] text-danger-text">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold">Provider account out of credits</div>
                      <div className="mt-0.5 wrap-break-word opacity-90">
                        {m.creditDetail ||
                          "A recent banner generation fell back because this model's provider account has insufficient credits."}
                      </div>
                      {m.creditCheckedAt && (
                        <div className="mt-1 opacity-70">
                          Detected {new Date(m.creditCheckedAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                )}

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

// ─────────────────────────────────────────────────────────────────────
// Workflow Stage Models — per-stage model assignment
// ─────────────────────────────────────────────────────────────────────

const TIER_STYLES = {
  lightweight: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    label: "Lightweight",
    icon: Zap,
  },
  standard: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    label: "Standard",
    icon: Sparkles,
  },
};

function WorkflowStages() {
  const [stagesData, setStagesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyStage, setBusyStage] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState(null);

  const loadStages = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/models/stages", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      setStagesData(data);
      setError(null);
    } catch (e) {
      setError(e.message || "Failed to load workflow stages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStages();
  }, []);

  const onAssign = async (stageId, modelId) => {
    setBusyStage(stageId);
    try {
      const res = await fetch("/api/admin/models/stages", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId, modelId: modelId || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      await loadStages();
    } catch (e) {
      setError(e.message || "Failed to update stage model");
    } finally {
      setBusyStage(null);
    }
  };

  const stages = stagesData?.stages || [];
  const availableModels = stagesData?.availableModels || [];
  const defaultModel = stagesData?.defaultModel;

  const lightweightCount = stages.filter(
    (s) => s.stage.tier === "lightweight" && s.model,
  ).length;
  const totalLightweight = stages.filter(
    (s) => s.stage.tier === "lightweight",
  ).length;

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left group"
      >
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Workflow className="h-4 w-4 text-primary" />
            Workflow stage models
          </h2>
          <p className="text-[11px] text-muted">
            Assign different models to each pipeline stage for cost optimization.
            Unassigned stages use the default text model{defaultModel ? ` (${defaultModel.label})` : ""}.
          </p>
        </div>
        <span className="shrink-0 rounded-lg p-1.5 text-muted group-hover:bg-surface-2 group-hover:text-foreground transition-colors">
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </button>

      {expanded && (
        <>
          {error && (
            <div className="rounded-xl border border-danger-border bg-danger-surface px-4 py-3 text-sm text-danger-text">
              {error}
            </div>
          )}

          {/* Cost optimization summary */}
          {stages.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-1 px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-foreground">
                  Cost optimization
                </div>
                <div className="text-[11px] text-muted">
                  {lightweightCount} of {totalLightweight} lightweight stages assigned to cheaper models.
                  {lightweightCount === 0 && " Assign lightweight models below to reduce costs."}
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3">
              {stages.map(({ stage, modelId, model }) => {
                const tier = TIER_STYLES[stage.tier] || TIER_STYLES.standard;
                const TierIcon = tier.icon;
                const isOverridden = !!model;
                const isBusy = busyStage === stage.id;

                return (
                  <Card key={stage.id} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {/* Stage info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {stage.label}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${tier.bg} ${tier.text} ${tier.border}`}
                          >
                            <TierIcon className="h-2.5 w-2.5" />
                            {tier.label}
                          </span>
                          {stage.requiresVision && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400"
                              title="This stage sends images to the model — requires a vision-capable model."
                            >
                              <Eye className="h-2.5 w-2.5" />
                              Vision
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted leading-relaxed">
                          {stage.description}
                        </p>
                      </div>

                      {/* Model selector */}
                      <div className="flex items-center gap-2 sm:min-w-[260px]">
                        <div className="flex-1">
                          <Select
                            value={modelId || ""}
                            disabled={isBusy}
                            onChange={(e) => onAssign(stage.id, e.target.value)}
                            className="text-xs"
                          >
                            <option value="">
                              Default{defaultModel ? ` — ${defaultModel.label}` : ""}
                            </option>
                            {availableModels.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.label} ({m.provider})
                              </option>
                            ))}
                          </Select>
                        </div>
                        {isOverridden && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onAssign(stage.id, "")}
                            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
                            title="Reset to default model"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Currently assigned model info */}
                    {isOverridden && model && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[11px]">
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                        <span className="text-muted">
                          Using{" "}
                          <span className="font-medium text-foreground">
                            {model.label}
                          </span>{" "}
                          <span className="text-muted">
                            ({model.provider} · {model.modelId})
                          </span>
                        </span>
                        {!model.enabled && (
                          <span className="ml-auto rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
                            Disabled
                          </span>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}