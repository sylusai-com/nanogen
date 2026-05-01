"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#a78bfa", "#ec4899", "#22d3ee", "#f59e0b"];

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border-strong)",
  borderRadius: 12,
  padding: "8px 10px",
  fontSize: 12,
  color: "var(--foreground)",
};

export default function ModelShareChart({ data }) {
  const series = data.map((m) => ({ name: m.label, runs: m.runs }));
  return (
    <div className="h-64 w-full" style={{ minHeight: "256px" }}>
      <ResponsiveContainer width="100%" height={256} minHeight={0}>
        <BarChart data={series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="name"
            stroke="var(--muted)"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            stroke="var(--muted)"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "color-mix(in oklab, var(--foreground) 4%, transparent)" }} />
          <Bar dataKey="runs" radius={[6, 6, 0, 0]}>
            {series.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
