"use client";

import { motion } from "motion/react";
import { Key, Clock, Activity, MoreVertical, Ban } from "lucide-react";
import Card from "@/components/ui/Card";

function formatDate(iso) {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  if (diffMs < 60_000) return "Just now";
  if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86400_000) return `${Math.floor(diffMs / 3600_000)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

export default function ApiKeyCard({ apiKey, index = 0, onRevoke }) {
  const isActive = apiKey.is_active;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Card elevated className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                isActive
                  ? "bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] text-primary"
                  : "bg-surface-2 text-muted"
              }`}
            >
              <Key className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground truncate">
                  {apiKey.name}
                </h3>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {isActive ? "Active" : "Revoked"}
                </span>
              </div>
              <div className="mt-1 font-mono text-xs text-muted">
                {apiKey.key_prefix}••••••••••••
              </div>
            </div>
          </div>

          {isActive && onRevoke && (
            <button
              type="button"
              onClick={() => onRevoke(apiKey.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-1.5 text-[11px] text-red-400 transition-colors hover:bg-red-500/10"
            >
              <Ban className="h-3 w-3" />
              Revoke
            </button>
          )}
        </div>

        {/* Meta row */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Created {formatDate(apiKey.created_at)}
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3" />
            Last used {formatDate(apiKey.last_used_at)}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-foreground">
              {apiKey.rate_limit_rpm}
            </span>
            <span>req/min</span>
            <span className="text-border-strong">·</span>
            <span className="font-mono text-foreground">
              {apiKey.rate_limit_rpd?.toLocaleString()}
            </span>
            <span>req/day</span>
          </div>
        </div>

        {/* Scopes */}
        {apiKey.scopes && apiKey.scopes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {apiKey.scopes.map((s) => (
              <span
                key={s}
                className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-muted-strong"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
