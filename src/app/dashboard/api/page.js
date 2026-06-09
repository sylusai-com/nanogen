// src/app/dashboard/api/page.js
"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Key,
  Activity,
  BarChart3,
  Terminal,
  Copy,
  Check,
  Code2,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import StatCard from "@/components/dashboard/StatCard";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import EmptyData from "@/components/ui/EmptyData";
import ApiKeyCard from "@/components/dashboard/ApiKeyCard";
import CreateApiKeyModal from "@/components/dashboard/CreateApiKeyModal";
import ApiUsageChart from "@/components/dashboard/ApiUsageChart";
import { useApiCache } from "@/lib/useApiCache";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nanogen.app";

const quickStartCode = `curl -X POST ${siteUrl}/api/v1/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Modern tech banner", "model": "MODEL_SLUG"}'`;

export default function ApiDashboard() {
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch keys
  const {
    data: keysData,
    isLoading: keysLoading,
    refetch: refetchKeys,
  } = useApiCache("/api/keys", {
    ttlMs: 30_000,
    tags: ["api-keys"],
    enabled: !!user,
    persist: false,
  });

  // Fetch usage stats
  const {
    data: statsData,
    isLoading: statsLoading,
  } = useApiCache(`/api/dashboard/stats?type=api`, {
    ttlMs: 60_000,
    tags: ["api-usage"],
    enabled: !!user,
    persist: false,
  });

  const keys = keysData?.keys || [];
  const stats = statsData?.apiStats || null;

  const handleRevoke = useCallback(
    async (keyId) => {
      if (!confirm("Revoke this API key? This action cannot be undone.")) return;
      try {
        await fetch("/api/keys", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyId }),
        });
        refetchKeys();
      } catch (e) {
        console.error("Failed to revoke key:", e);
      }
    },
    [refetchKeys],
  );

  const handleCreated = useCallback(() => {
    refetchKeys();
  }, [refetchKeys]);

  const handleCopy = () => {
    navigator.clipboard.writeText(quickStartCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeKeys = keys.filter((k) => k.is_active);
  const revokedKeys = keys.filter((k) => !k.is_active);

  const statCards = [
    {
      label: "Active keys",
      value: activeKeys.length,
      icon: <Key className="h-4 w-4" />,
    },
    {
      label: "Requests today",
      value: stats?.todayRequests ?? "—",
      icon: <Activity className="h-4 w-4" />,
    },
    {
      label: "Total requests",
      value: stats?.totalRequests ?? "—",
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      label: "Rate limit",
      value: "60/min",
      icon: <Terminal className="h-4 w-4" />,
    },
  ];

  return (
    <>
      <TopBar
        title="API"
        action={
          <Button
            onClick={() => setModalOpen(true)}
            leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
          >
            Create API key
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-7xl space-y-8 px-5 py-8 md:px-8 md:py-10">
        {/* KPI cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s, i) => (
            <StatCard key={s.label} {...s} delay={i * 0.05} />
          ))}
        </section>

        {/* Usage chart */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Card elevated className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">
                  API Usage · last 14 days
                </h3>
                <p className="text-[11px] text-muted">Requests per day.</p>
              </div>
            </div>
            <div className="mt-4">
              {statsLoading ? (
                <Skeleton className="h-64" />
              ) : (
                <ApiUsageChart data={stats?.daily || []} />
              )}
            </div>
          </Card>

          {/* Quick start */}
          <Card elevated className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">
                Quick start
              </h3>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] text-muted transition-colors hover:bg-surface-2"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-background p-4 text-[11px] leading-relaxed text-muted-strong font-mono">
              <code>{quickStartCode}</code>
            </pre>
            <div className="mt-4 space-y-2 text-xs text-muted">
              <p>
                <strong className="text-foreground">Base URL:</strong>{" "}
                <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px]">
                  /api/v1
                </code>
              </p>
              <p>
                <strong className="text-foreground">Endpoints:</strong>
              </p>
              <ul className="ml-4 space-y-1 list-disc">
                <li>
                  <code className="text-[11px]">POST /v1/generate</code> —
                  Generate an image
                </li>
                <li>
                  <code className="text-[11px]">GET /v1/models</code> — List
                  available models
                </li>
              </ul>
            </div>
          </Card>
        </section>

        {/* API Keys list */}
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">API Keys</h2>
              <p className="text-xs text-muted">
                Manage your API keys for programmatic access.
              </p>
            </div>
            <Button
              onClick={() => setModalOpen(true)}
              size="sm"
              variant="secondary"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              New key
            </Button>
          </div>

          {keysLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : activeKeys.length || revokedKeys.length ? (
            <div className="space-y-3">
              {activeKeys.map((k, i) => (
                <ApiKeyCard
                  key={k.id}
                  apiKey={k}
                  index={i}
                  onRevoke={handleRevoke}
                />
              ))}
              {revokedKeys.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs text-muted hover:text-foreground transition-colors">
                    {revokedKeys.length} revoked key
                    {revokedKeys.length > 1 ? "s" : ""}
                  </summary>
                  <div className="mt-2 space-y-3 opacity-60">
                    {revokedKeys.map((k, i) => (
                      <ApiKeyCard key={k.id} apiKey={k} index={i} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : (
            <EmptyData
              icon={<Key className="h-5 w-5" />}
              title="No API keys yet"
              body="Create your first API key to start using the Nanogen API programmatically."
              action={
                <Button
                  onClick={() => setModalOpen(true)}
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  Create API key
                </Button>
              }
            />
          )}
        </section>
      </div>

      <CreateApiKeyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
