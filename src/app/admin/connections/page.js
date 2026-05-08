// src/app/admin/connections/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Database, FlaskConical, Plug, RefreshCw, Shield, Sparkles } from "lucide-react";
import TopBar from "@/components/dashboard/TopBar";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { useAuth } from "@/components/layout/AuthProvider";

function ResultBlock({ title, result }) {
  const ok = !!result?.ok;
  return (
    <Card elevated className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted">{title}</div>
          <div className="mt-1 text-sm text-muted">
            {ok ? "Connection looks healthy" : "Not tested yet"}
          </div>
        </div>
        <Badge tone={ok ? "primary" : "neutral"}>
          {ok ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertCircle className="mr-1 h-3 w-3" />}
          {ok ? "OK" : "Pending"}
        </Badge>
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
  const [summary, setSummary] = useState(null);
  const [models, setModels] = useState([]);
  const [providers, setProviders] = useState([]);
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, modelsRes, providersRes] = await Promise.all([
        fetch("/api/admin/connections", { cache: "no-store" }),
        fetch("/api/admin/models?page=1&pageSize=100", { cache: "no-store" }),
        fetch("/api/admin/bg-image-providers", { cache: "no-store" }),
      ]);

      const [summaryData, modelsData, providersData] = await Promise.all([
        summaryRes.json(),
        modelsRes.json(),
        providersRes.json(),
      ]);

      if (!summaryRes.ok) throw new Error(summaryData.error || "Failed to load summary");
      if (!modelsRes.ok) throw new Error(modelsData.error || "Failed to load models");
      if (!providersRes.ok) throw new Error(providersData.error || "Failed to load providers");

      setSummary(summaryData);
      setModels(modelsData.models || []);
      setProviders(providersData.providers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const testAction = async (action, payload = {}) => {
    setRunning(action);
    setError(null);
    try {
      const res = await fetch("/api/admin/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || `Request failed (${res.status})`);
      setResults((prev) => ({ ...prev, [action]: data.result || data }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(null);
    }
  };

  const primaryModel = useMemo(() => models.find((m) => m.kind === "text" && m.enabled) || models[0], [models]);
  const primaryProvider = useMemo(() => providers.find((p) => p.enabled) || providers[0], [providers]);

  return (
    <>
      <TopBar title="Connections" action={null} />
      <div className="mx-auto w-full max-w-7xl space-y-8 px-5 py-8 md:px-8 md:py-10">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-medium text-muted-strong">
            <Plug className="h-3.5 w-3.5 text-primary" />
            Diagnostics and health checks
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Check database, providers, and model flow</h1>
          <p className="max-w-2xl text-sm text-muted">
            Use this page to verify that the app can reach Supabase, call the active AI model, and fetch background images from the configured providers.
          </p>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card elevated className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted">Database</div>
                <div className="mt-1 text-sm text-muted">Supabase connectivity</div>
              </div>
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-2xl font-semibold">{summary?.database ? "OK" : "—"}</div>
              <Button size="sm" variant="secondary" onClick={() => testAction("db")} disabled={running === "db"}>
                {running === "db" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Test"}
              </Button>
            </div>
            <div className="mt-2 text-xs text-muted">
              {summary?.models ? `${summary.models.enabledText || 0} text models` : "Loading…"}
            </div>
          </Card>

          <Card elevated className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted">Model ping</div>
                <div className="mt-1 text-sm text-muted">OpenRouter-compatible request</div>
              </div>
              <FlaskConical className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-2xl font-semibold">{primaryModel ? primaryModel.label : "—"}</div>
              <Button
                size="sm"
                onClick={() => testAction("model", { modelRef: primaryModel?.id || primaryModel?.slug })}
                disabled={running === "model" || !primaryModel}
              >
                {running === "model" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Test"}
              </Button>
            </div>
            <div className="mt-2 text-xs text-muted">
              {primaryModel ? primaryModel.provider : "No enabled model"}
            </div>
          </Card>

          <Card elevated className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted">BG provider</div>
                <div className="mt-1 text-sm text-muted">Image API connectivity</div>
              </div>
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-2xl font-semibold">{primaryProvider ? primaryProvider.name : "—"}</div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => testAction("provider", { providerId: primaryProvider?.id })}
                disabled={running === "provider" || !primaryProvider}
              >
                {running === "provider" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Test"}
              </Button>
            </div>
            <div className="mt-2 text-xs text-muted">
              {primaryProvider ? primaryProvider.type : "No provider configured"}
            </div>
          </Card>

          <Card elevated className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted">Full flow</div>
                <div className="mt-1 text-sm text-muted">Model + background provider</div>
              </div>
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-2xl font-semibold">Run</div>
              <Button
                size="sm"
                onClick={() => testAction("flow", { modelRef: primaryModel?.id || primaryModel?.slug, providerId: primaryProvider?.id })}
                disabled={running === "flow" || !primaryModel}
              >
                {running === "flow" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Test"}
              </Button>
            </div>
            <div className="mt-2 text-xs text-muted">
              Execute both checks back-to-back.
            </div>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {loading ? (
            <>
              <Skeleton className="h-80" />
              <Skeleton className="h-80" />
            </>
          ) : (
            <>
              <ResultBlock title="Database" result={results.db || summary} />
              <ResultBlock title="Model flow" result={results.flow || results.model} />
              <ResultBlock title="Provider" result={results.provider} />
              <Card elevated className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted">Connected resources</div>
                    <div className="mt-1 text-sm text-muted">Loaded from admin APIs</div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={load}>
                    Refresh
                  </Button>
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-2 px-4 py-3">
                    <span className="text-muted">Enabled text models</span>
                    <span className="font-semibold">{summary?.models?.enabledText ?? models.filter((m) => m.kind === "text" && m.enabled).length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-2 px-4 py-3">
                    <span className="text-muted">Enabled image models</span>
                    <span className="font-semibold">{summary?.models?.enabledImage ?? models.filter((m) => m.kind === "image" && m.enabled).length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-2 px-4 py-3">
                    <span className="text-muted">Background providers</span>
                    <span className="font-semibold">{summary?.bgProviders ?? providers.filter((p) => p.enabled).length}</span>
                  </div>
                </div>
              </Card>
            </>
          )}
        </section>
      </div>
    </>
  );
}
