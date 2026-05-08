// src/app/admin/connections/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, ArrowRight, CheckCircle2, Cpu, Database, FlaskConical, Plug, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";

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
  if (!res.ok) throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  return data;
}

function modelKey(model) {
  return `model:${model.id}`;
}

function providerKey(provider) {
  return `provider:${provider.id}`;
}

function statusBadge(result) {
  if (!result) {
    return { tone: "neutral", label: "Pending", meta: "Not tested yet" };
  }
  return result.ok
    ? { tone: "primary", label: "OK", meta: result.model?.label || result.provider?.name || "Healthy" }
    : { tone: "neutral", label: "Failed", meta: result.error || result.message || "Unknown error" };
}

function ModelCard({ model, result, busy, onTest }) {
  const badge = statusBadge(result);
  return (
    <Card elevated className="group overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground">{model.label}</h3>
            <Badge tone={model.enabled ? "primary" : "neutral"}>{model.enabled ? "Enabled" : "Disabled"}</Badge>
            <Badge tone="neutral">{model.kind}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-medium uppercase tracking-[0.14em] text-muted-strong">{model.provider}</span>
            <span className="font-mono text-[11px] text-muted-strong">{model.modelId}</span>
          </div>
        </div>

        <div className="text-right">
          {model.hasApiKey ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
              <CheckCircle2 className="h-3 w-3" /> Key set
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300">
              <AlertCircle className="h-3 w-3" /> Key missing
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3">
          <div className="uppercase tracking-[0.16em] text-muted">Connection</div>
          <div className="mt-1 text-foreground">{badge.label}</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3">
          <div className="uppercase tracking-[0.16em] text-muted">Status</div>
          <div className="mt-1 truncate text-foreground">{badge.meta}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <div className="text-[11px] text-muted">Tests the same request path used by the generation flow.</div>
        <Button size="sm" variant="secondary" onClick={onTest} disabled={busy} leftIcon={busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}>
          {busy ? "Testing" : "Test"}
        </Button>
      </div>
    </Card>
  );
}

function ProviderCard({ provider, result, busy, onTest }) {
  const badge = statusBadge(result);
  return (
    <Card elevated className="group overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground">{provider.name}</h3>
            <Badge tone={provider.enabled ? "primary" : "neutral"}>{provider.enabled ? "Enabled" : "Disabled"}</Badge>
            <Badge tone="neutral">{provider.type}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="font-mono text-[11px] text-muted-strong">{provider.api_endpoint || "—"}</span>
          </div>
        </div>

        {provider.hasApiKey ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Key set
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300">
            <AlertCircle className="h-3 w-3" /> Key missing
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3">
          <div className="uppercase tracking-[0.16em] text-muted">Connection</div>
          <div className="mt-1 text-foreground">{badge.label}</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3">
          <div className="uppercase tracking-[0.16em] text-muted">Status</div>
          <div className="mt-1 truncate text-foreground">{badge.meta}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <div className="text-[11px] text-muted">Used by the background-image fetch flow and diagnostics.</div>
        <Button size="sm" variant="secondary" onClick={onTest} disabled={busy} leftIcon={busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}>
          {busy ? "Testing" : "Test"}
        </Button>
      </div>
    </Card>
  );
}

function ConnectionSummaryCard({ title, subtitle, value, meta, icon, onAction, actionLabel, loading, result }) {
  const isBatch = typeof result?.total === "number";
  const ok = result ? (isBatch ? result.failed === 0 : !!result.ok || !!result.database) : false;
  const badgeLabel = !result
    ? "Pending"
    : isBatch
      ? `${result.passed ?? 0}/${result.total ?? 0} passed`
      : ok
      ? "OK"
      : "Failed";
  const metaText = !result
    ? meta
    : isBatch
    ? `${result.failed ?? 0} failed`
    : result.model?.label || result.provider?.name || meta;
  return (
    <Card elevated className="relative overflow-hidden p-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-cyan-400 via-sky-500 to-indigo-500 opacity-80" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {icon}
            <div className="text-xs uppercase tracking-[0.18em] text-muted">{title}</div>
          </div>
          <div className="mt-1 text-sm text-muted">{subtitle}</div>
        </div>
        <Badge tone={ok ? "primary" : "neutral"}>{badgeLabel}</Badge>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
          <div className="mt-1 text-xs text-muted">{metaText}</div>
        </div>
        <Button size="sm" variant="secondary" onClick={onAction} disabled={loading} leftIcon={loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}>
          {loading ? "Running" : actionLabel}
        </Button>
      </div>

      {result && (
        <pre className="mt-4 overflow-auto rounded-2xl bg-surface-2 p-4 text-[11px] leading-5 text-muted-strong">
{JSON.stringify(result, null, 2)}
        </pre>
      )}
    </Card>
  );
}

export default function AdminConnectionsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(null);
  const [results, setResults] = useState({});
  const [latestBatch, setLatestBatch] = useState(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/connections", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load diagnostics");
      setCatalog(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const textModels = catalog?.models?.text || [];
  const imageModels = catalog?.models?.image || [];
  const providers = catalog?.providers || [];

  const setModelResult = (result) => {
    if (!result?.model?.id) return;
    setResults((current) => ({ ...current, [modelKey(result.model)]: result }));
  };

  const setProviderResult = (result) => {
    if (!result?.provider?.id) return;
    setResults((current) => ({ ...current, [providerKey(result.provider)]: result }));
  };

  const applyBatchResults = (items) => {
    if (!Array.isArray(items)) return;
    setResults((current) => {
      const next = { ...current };
      for (const item of items) {
        if (item?.model?.id) next[modelKey(item.model)] = item;
        if (item?.provider?.id) next[providerKey(item.provider)] = item;
      }
      return next;
    });
  };

  const testAction = async (action, payload = {}) => {
    setRunning(action);
    setError(null);
    try {
      const data = await adminFetch("/api/admin/connections", {
        method: "POST",
        body: JSON.stringify({ action, ...payload }),
      });
      setLatestBatch({ action, result: data.result });

      if (action === "model") {
        setModelResult(data.result);
      } else if (action === "provider") {
        setProviderResult(data.result);
      } else if (action === "models") {
        applyBatchResults(data.result?.results);
      } else if (action === "providers") {
        applyBatchResults(data.result?.results);
      } else if (action === "flow") {
        applyBatchResults(data.result?.models?.results);
        applyBatchResults(data.result?.providers?.results);
      }
    } catch (err) {
      setError(err.message || "Diagnostics failed");
    } finally {
      setRunning(null);
    }
  };

  const summaryCards = useMemo(
    () => [
      { title: "Database", value: catalog?.database ? "Healthy" : "—", meta: catalog?.timestamp ? "Reachable right now" : "Waiting for check", icon: <Database className="h-5 w-5" /> },
      { title: "Text models", value: textModels.length || "—", meta: "HTML banner generation", icon: <FlaskConical className="h-5 w-5" /> },
      { title: "Image models", value: imageModels.length || "—", meta: "Background generation", icon: <Sparkles className="h-5 w-5" /> },
      { title: "BG providers", value: providers.length || "—", meta: "Image source registry", icon: <Plug className="h-5 w-5" /> },
    ],
    [catalog, textModels.length, imageModels.length, providers.length],
  );

  return (
    <>
      <TopBar title="Connections" action={null} />

      <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <header className="relative overflow-hidden rounded-3xl border border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(9,9,16,0.98))] p-6 shadow-[0_24px_90px_-48px_rgba(0,0,0,0.75)] md:p-8">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-size-[24px_24px] opacity-30" />
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-fuchsia-400/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/75 backdrop-blur">
                <Activity className="h-3.5 w-3.5" /> Diagnostics for the live generation stack
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Connection diagnostics, reworked for fast scanning and sharper decisions.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 md:text-[15px]">
                  Run the full stack in parallel, inspect individual model and provider results, and confirm the current admin setup is ready before users hit the generator.
                </p>
              </div>
              {error && (
                <div className="inline-flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur">
                  <TriangleAlert className="h-4 w-4" /> {error}
                </div>
              )}
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-105 lg:grid-cols-2">
              {summaryCards.map((card) => (
                <div key={card.title} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{card.title}</div>
                      <div className="mt-2 text-3xl font-semibold text-white">{card.value}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-cyan-200">{card.icon}</div>
                  </div>
                  <div className="mt-2 text-xs text-white/55">{card.meta}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={() => testAction("models")} disabled={running === "models"} leftIcon={running === "models" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}>Test all models</Button>
            <Button variant="secondary" onClick={() => testAction("providers")} disabled={running === "providers"} leftIcon={running === "providers" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}>Test all providers</Button>
            <Button variant="secondary" onClick={() => testAction("flow")} disabled={running === "flow"} leftIcon={running === "flow" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}>Full system sweep</Button>
            <Button variant="secondary" onClick={load} disabled={loading} leftIcon={loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}>Refresh inventory</Button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36" />)
          ) : (
            <>
              <ConnectionSummaryCard
                title="Database"
                subtitle="Supabase auth + query layer"
                value={catalog?.database ? "OK" : "—"}
                meta={catalog?.timestamp ? new Date(catalog.timestamp).toLocaleTimeString() : "Run a check"}
                icon={<Database className="h-4 w-4" />}
                onAction={() => testAction("db")}
                actionLabel="Test DB"
                loading={running === "db"}
                result={latestBatch?.action === "db" ? latestBatch.result : null}
              />
              <ConnectionSummaryCard
                title="Text models"
                subtitle="HTML banner generation"
                value={textModels.length || 0}
                meta="OpenRouter-compatible chat models"
                icon={<FlaskConical className="h-4 w-4" />}
                onAction={() => testAction("models")}
                actionLabel="Test all"
                loading={running === "models"}
                result={latestBatch?.action === "models" ? latestBatch.result : null}
              />
              <ConnectionSummaryCard
                title="Image models"
                subtitle="Banner background generation"
                value={imageModels.length || 0}
                meta="Used for AI backgrounds"
                icon={<Sparkles className="h-4 w-4" />}
                onAction={() => testAction("models")}
                actionLabel="Test all"
                loading={running === "models"}
                result={latestBatch?.action === "models" ? latestBatch.result : null}
              />
              <ConnectionSummaryCard
                title="BG providers"
                subtitle="External image search APIs"
                value={providers.length || 0}
                meta="Unsplash / Pexels / Pixabay / custom"
                icon={<Plug className="h-4 w-4" />}
                onAction={() => testAction("providers")}
                actionLabel="Test all"
                loading={running === "providers"}
                result={latestBatch?.action === "providers" ? latestBatch.result : null}
              />
            </>
          )}
        </section>

        {catalog && (
          <section className="space-y-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Text models</div>
                  <h2 className="text-lg font-semibold text-foreground">HTML generators</h2>
                </div>
                <Badge tone="primary">{textModels.length} enabled</Badge>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {textModels.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    result={results[modelKey(model)]}
                    busy={running === `model:${model.id}`}
                    onTest={() => testAction("model", { modelRef: model.id, kind: "text" })}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Image models</div>
                  <h2 className="text-lg font-semibold text-foreground">Background generators</h2>
                </div>
                <Badge tone="primary">{imageModels.length} enabled</Badge>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {imageModels.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    result={results[modelKey(model)]}
                    busy={running === `model:${model.id}`}
                    onTest={() => testAction("model", { modelRef: model.id, kind: "image" })}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted">BG providers</div>
                  <h2 className="text-lg font-semibold text-foreground">Image sources</h2>
                </div>
                <Badge tone="primary">{providers.length} configured</Badge>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {providers.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    result={results[providerKey(provider)]}
                    busy={running === `provider:${provider.id}`}
                    onTest={() => testAction("provider", { providerId: provider.id })}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {latestBatch && (
          <Card elevated className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted">Latest sweep</div>
                <h2 className="mt-1 text-lg font-semibold text-foreground">{latestBatch.action}</h2>
              </div>
              <Badge tone="primary">{latestBatch.result?.passed ?? 0} passed</Badge>
            </div>
            <pre className="mt-4 overflow-auto rounded-2xl bg-surface-2 p-4 text-[11px] leading-5 text-muted-strong">
{JSON.stringify(latestBatch.result, null, 2)}
            </pre>
          </Card>
        )}
      </div>
    </>
  );
}