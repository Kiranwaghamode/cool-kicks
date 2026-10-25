"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPaise } from "@/lib/money";

/**
 * Chart palette – validated with the dataviz validator (light surface): fixed order, never cycled.
 * green · blue · orange · pink. Orange is below 3:1 contrast, so every chart shows direct value labels.
 */
export const CHART_COLORS = ["#5a8f24", "#2a6fdb", "#d98a00", "#c2185b"] as const;
const SINGLE = CHART_COLORS[0];
const GRID = "#ece6d8";
const AXIS = "#6e6e6e";

function rupeesShort(paise: number) {
  const r = paise / 100;
  if (r >= 100000) return `₹${(r / 100000).toFixed(1)}L`;
  if (r >= 1000) return `₹${(r / 1000).toFixed(1)}k`;
  return `₹${Math.round(r)}`;
}

function TooltipBox({ active, payload, label, unit }: { active?: boolean; payload?: { value: number; payload: Record<string, unknown> }[]; label?: string; unit: "money" | "count" }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const orders = p.payload.orders as number | undefined;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-glass">
      <p className="font-semibold text-ink">{label}</p>
      <p className="text-ink-soft">
        {unit === "money" ? formatPaise(p.value) : p.value}
        {orders !== undefined && ` · ${orders} order${orders === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}

/** Daily sales – single series, vertical bars. */
export function DailySalesChart({ data, height = 260 }: { data: { label: string; value: number; orders?: number }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label={`Daily sales: ${data.map((d) => `${d.label} ${formatPaise(d.value)}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} tickFormatter={rupeesShort} width={52} />
          <Tooltip cursor={{ fill: "rgb(107 163 46 / 0.08)" }} content={<TooltipBox unit="money" />} />
          <Bar dataKey="value" fill={SINGLE} radius={[4, 4, 0, 0]} maxBarSize={44}>
            {data.length <= 14 && <LabelList dataKey="value" position="top" formatter={(v: unknown) => (Number(v) ? rupeesShort(Number(v)) : "")} style={{ fill: "#555", fontSize: 11 }} />}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal ranked bars (sales by category, by payment method…). Values are direct-labelled. */
export function RankedBars({
  data,
  unit = "money",
  colorBy = "single",
}: {
  data: { label: string; value: number }[];
  unit?: "money" | "count";
  /** "category" gives each bar its own fixed-order hue (≤4 bars). */
  colorBy?: "single" | "category";
}) {
  const height = Math.max(80, data.length * 40 + 16);
  return (
    <div style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${unit === "money" ? formatPaise(d.value) : d.value}`).join(", ")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={130} tick={{ fill: "#111", fontSize: 13 }} />
          <Tooltip cursor={{ fill: "rgb(107 163 46 / 0.08)" }} content={<TooltipBox unit={unit} />} />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            maxBarSize={26}
            isAnimationActive={false}
            label={{
              position: "right",
              fill: "#555",
              fontSize: 12,
              fontWeight: 600,
              formatter: (v: unknown) => (unit === "money" ? rupeesShort(Number(v)) : String(v)),
            }}
          >
            {data.map((d, i) => (
              <Cell key={d.label} fill={colorBy === "category" ? CHART_COLORS[i % CHART_COLORS.length] : SINGLE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
