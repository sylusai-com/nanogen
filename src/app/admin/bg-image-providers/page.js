// src/app/admin/bg-image-providers/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Edit3, Plus, RefreshCw, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import Skeleton from "@/components/ui/Skeleton";
import EmptyData from "@/components/ui/EmptyData";
import BgProviderFormModal from "@/components/admin/BgProviderFormModal";
import { invalidateTags } from "@/lib/cache";

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

function ProviderCard({ provider, busy, onEdit, onToggle, onDelete }) {
  const endpoint = provider.api_endpoint || "—";
  const hasConfig = provider.config && Object.keys(provider.config).length > 0;

  return (
    <Card elevated className="group relative overflow-hidden p-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-cyan-400 via-sky-500 to-indigo-500 opacity-80" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground">{provider.name}</h3>
            <Badge tone={provider.enabled ? "primary" : "neutral"}>{provider.enabled ? "Enabled" : "Disabled"}</Badge>
            {provider.hasApiKey ? (
              <Badge tone="primary"><CheckCircle2 className="mr-1 h-2.5 w-2.5" /> Key set</Badge>
            ) : (
              <Badge tone="neutral"><AlertCircle className="mr-1 h-2.5 w-2.5" /> Missing key</Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-medium uppercase tracking-[0.14em] text-muted-strong">{provider.type}</span>
            <span className="truncate font-mono text-[11px] text-muted-strong">{endpoint}</span>
          </div>
        </div>

        <Switch checked={provider.enabled} disabled={busy} onChange={() => onToggle(provider)} ariaLabel="Toggle provider enabled" />
      </div>

      <div className="mt-5 grid gap-3 text-xs sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3">
          <div className="uppercase tracking-[0.16em] text-muted">Endpoint</div>
          <div className="mt-1 truncate font-mono text-foreground">{endpoint}</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3">
          <div className="uppercase tracking-[0.16em] text-muted">Config</div>
          <div className="mt-1 text-foreground">{hasConfig ? `${Object.keys(provider.config).length} settings` : "No extra config"}</div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <div className="text-[11px] text-muted">Used by background-image fetches and generation diagnostics.</div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onEdit(provider)} disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] text-muted-strong hover:bg-surface-2 hover:text-foreground transition-colors">
            <Edit3 className="h-3.5 w-3.5" /> Edit
          </button>
          <button type="button" onClick={() => onDelete(provider)} disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-colors">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>
    </Card>
  );
}

export default function AdminBgImageProviders() {
  const { user } = useAuth();
  const [providers, setProviders] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState({ open: false, provider: null });
  const [busyId, setBusyId] = useState(null);

  const reload = async () => {
    try {
      const res = await fetch("/api/admin/bg-image-providers", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Providers load failed (${res.status})`);
      setProviders(data.providers || []);
    } catch (err) {
      setError(err.message || "Failed to load providers");
    }
  };

  useEffect(() => {
    if (user?.id) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const onCreate = async (form) => {
    await adminFetch("/api/admin/bg-image-providers", {
      method: "POST",
      body: JSON.stringify(form),
    });
    invalidateTags(["bg-image-providers"]);
    await reload();
  };

  const onUpdate = async (form) => {
    if (!modal.provider?.id) return;
    const patch = { ...form };
    if (!patch.api_key) delete patch.api_key;
    await adminFetch(`/api/admin/bg-image-providers/${modal.provider.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    invalidateTags(["bg-image-providers"]);
    await reload();
  };

  const onToggle = async (provider) => {
    setBusyId(provider.id);
    try {
      await adminFetch(`/api/admin/bg-image-providers/${provider.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !provider.enabled }),
      });
      invalidateTags(["bg-image-providers"]);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (provider) => {
    if (!confirm(`Delete ${provider.name}? This cannot be undone.`)) return;
    setBusyId(provider.id);
    try {
      await adminFetch(`/api/admin/bg-image-providers/${provider.id}`, { method: "DELETE" });
      invalidateTags(["bg-image-providers"]);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const enabledCount = useMemo(() => (providers || []).filter((provider) => provider.enabled).length, [providers]);
  const keyCount = useMemo(() => (providers || []).filter((provider) => provider.hasApiKey).length, [providers]);

  return (
    <>
      <TopBar
        title="BG Providers"
        action={<Button leftIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2.5} />} onClick={() => setModal({ open: true, provider: null })}>Add provider</Button>}
      />

      <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <header className="relative overflow-hidden rounded-3xl border border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(9,9,16,0.98))] p-6 shadow-[0_24px_90px_-48px_rgba(0,0,0,0.75)] md:p-8">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-size-[24px_24px] opacity-30" />
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-fuchsia-400/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/75 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" /> Admin registry for background-image providers
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Provider registry, reworked for fast scanning and sharper decisions.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 md:text-[15px]">
                  Add, edit, enable, or disable image providers from a single place. These providers power automatic background selection in generation and diagnostics.
                </p>
              </div>
              {error && (
                <div className="inline-flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur">
                  <TriangleAlert className="h-4 w-4" /> {error}
                </div>
              )}
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-105 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Providers</div>
                <div className="mt-2 text-3xl font-semibold text-white">{providers?.length ?? "—"}</div>
                <div className="mt-1 text-xs text-white/55">Registered image sources</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Enabled</div>
                <div className="mt-2 text-3xl font-semibold text-white">{providers ? enabledCount : "—"}</div>
                <div className="mt-1 text-xs text-white/55">Active in generation</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Keys set</div>
                <div className="mt-2 text-3xl font-semibold text-white">{providers ? keyCount : "—"}</div>
                <div className="mt-1 text-xs text-white/55">Ready for API calls</div>
              </div>
            </div>
          </div>
        </header>

        {!providers ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-56" />)}
          </div>
        ) : providers.length === 0 ? (
          <EmptyData
            icon={<Sparkles className="h-5 w-5" />}
            title="No background-image providers yet"
            body="Add one to let the generator fetch relevant imagery automatically."
            action={<Button leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setModal({ open: true, provider: null })}>Add provider</Button>}
          />
        ) : (
          <section className="grid gap-4 xl:grid-cols-2">
            {providers.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                busy={busyId === provider.id}
                onEdit={(next) => setModal({ open: true, provider: next })}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            ))}
          </section>
        )}
      </div>

      <BgProviderFormModal
        open={modal.open}
        provider={modal.provider}
        onClose={() => setModal({ open: false, provider: null })}
        onSubmit={modal.provider ? onUpdate : onCreate}
      />
    </>
  );
}