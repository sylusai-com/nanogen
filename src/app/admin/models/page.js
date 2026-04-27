// src/app/admin/models/page.js
"use client";

import { useEffect, useState } from "react";
import { Cpu, Edit3, Plus, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import Skeleton from "@/components/ui/Skeleton";
import EmptyData from "@/components/ui/EmptyData";
import ModelFormModal from "@/components/admin/ModelFormModal";
import {
  createModel,
  deleteModel,
  listAllModels,
  updateModel,
} from "@/lib/db/models";
import { PROVIDER_KEY_ENV } from "@/lib/models";

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

export default function AdminModels() {
  const { user, supabase } = useAuth();
  const [models, setModels] = useState(null);
  const [share, setShare] = useState({});
  const [error, setError] = useState(null);
  const [modal, setModal] = useState({ open: false, model: null });
  const [busyId, setBusyId] = useState(null);

  const reload = async () => {
    try {
      const rows = await listAllModels(supabase);
      setModels(rows);
      // pull live aggregates from generation_results
      const { data } = await supabase
        .from("generation_results")
        .select("model_id, score, latency_ms");
      const map = {};
      for (const r of data || []) {
        if (!map[r.model_id])
          map[r.model_id] = { runs: 0, score: 0, lats: [] };
        map[r.model_id].runs++;
        if (r.score != null) map[r.model_id].score += r.score;
        if (r.latency_ms != null) map[r.model_id].lats.push(r.latency_ms);
      }
      const total = (data || []).length || 1;
      const summary = {};
      for (const k of Object.keys(map)) {
        const m = map[k];
        const lats = m.lats.sort((a, b) => a - b);
        summary[k] = {
          runs: m.runs,
          share: m.runs / total,
          avgScore: m.runs ? Math.round(m.score / m.runs) : null,
          p50ms: lats.length ? lats[Math.floor(lats.length * 0.5)] : null,
        };
      }
      setShare(summary);
    } catch (e) {
      setError(e.message || "Failed to load models");
    }
  };

  useEffect(() => {
    if (user) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onCreate = async (form) => {
    await createModel(supabase, form);
    await reload();
  };

  const onUpdate = async (form) => {
    if (!modal.model?.id) return;
    await updateModel(supabase, modal.model.id, form);
    await reload();
  };

  const onToggleEnabled = async (m) => {
    setBusyId(m.id);
    try {
      await updateModel(supabase, m.id, { enabled: !m.enabled });
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const onMakeDefault = async (m) => {
    setBusyId(m.id);
    try {
      await updateModel(supabase, m.id, { isDefault: true });
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (m) => {
    if (!confirm(`Delete ${m.label}? This cannot be undone.`)) return;
    setBusyId(m.id);
    try {
      await deleteModel(supabase, m.id);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const imageModels = (models || []).filter((m) => m.kind === "image");
  const textModels = (models || []).filter((m) => m.kind === "text");

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
            Image models drive generation. Text models drive the HTML banner generator
            via OpenRouter. Performance numbers come from{" "}
            <code className="font-mono text-muted-strong">generation_results</code>.
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
              subtitle="Drive /api/banners/html via OpenRouter. Mark one as default."
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
            const live = share[m.slug];
            const envVar = PROVIDER_KEY_ENV[m.provider];
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
                      API key env
                    </dt>
                    <dd className="mt-1 truncate font-mono text-foreground">
                      {envVar || "—"}
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
