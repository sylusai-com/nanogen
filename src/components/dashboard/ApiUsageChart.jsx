"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface p-3 text-xs shadow-lg">
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-1 text-muted">
        <span className="font-mono text-primary">{payload[0].value.toLocaleString()}</span>{" "}
        requests
      </p>
    </div>
  );
}

export default function ApiUsageChart({ data = [], height = 260 }) {
  const formatted = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      })),
    [data],
  );

  if (!formatted.length) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-border bg-background text-xs text-muted"
        style={{ height }}
      >
        No API usage data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formatted} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="apiUsageGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "var(--muted)" }}
          dy={8}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "var(--muted)" }}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="requests"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#apiUsageGrad)"
          animationDuration={800}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
