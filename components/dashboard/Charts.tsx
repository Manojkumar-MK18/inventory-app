"use client";

import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart,
  CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList,
} from "recharts";
import { formatINR } from "@/lib/money";

// Validated categorical palette (dataviz reference, light mode).
const CAT = ["#2a78d6", "#008300", "#e87ba4", "#eda100", "#1baf7a", "#eb6834"];
const PRIMARY = "#2a78d6";
// Friendly labels for payment methods.
const PAY_LABEL: Record<string, string> = { CASH: "Cash", UPI: "UPI", CARD: "Card", CREDIT: "Due" };

const axisMoney = (v: number) =>
  v >= 10000000 ? `₹${(v / 10000000).toFixed(1)}Cr` : v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${Math.round(v / 100)}`;
const tip = { borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 } as const;
const axisTick = { fill: "#9ca3af", fontSize: 11 } as const;

function Card({ title, subtitle, empty, children }: { title: string; subtitle?: string; empty?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="mb-3 text-xs text-gray-400">{subtitle}</p>}
      {empty ? <div className="flex h-56 items-center justify-center text-sm text-gray-400">No data yet.</div> : <div className={subtitle ? "" : "mt-3"}>{children}</div>}
    </div>
  );
}

/** Sales trend — line/area over time (best form for change-over-time). */
export function TrendChart({ data }: { data: { label: string; total: number }[] }) {
  const empty = data.every((d) => d.total === 0);
  return (
    <Card title="Daily sales" subtitle="Last 14 days" empty={empty}>
      <ResponsiveContainer width="100%" height={224}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.25} />
              <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} interval={1} />
          <YAxis tickLine={false} axisLine={false} width={48} tick={axisTick} tickFormatter={axisMoney} />
          <Tooltip formatter={(v: number) => [formatINR(v), "Sales"]} contentStyle={tip} />
          <Area type="monotone" dataKey="total" stroke={PRIMARY} strokeWidth={2} fill="url(#trendFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

/** Payment mix — composition donut with a labelled legend (identity not by colour alone). */
export function PaymentDonut({ data }: { data: { method: string; total: number }[] }) {
  const total = data.reduce((a, d) => a + d.total, 0);
  return (
    <Card title="How customers paid" subtitle="This month" empty={data.length === 0}>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width="55%" height={180}>
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="method" innerRadius={45} outerRadius={75} paddingAngle={2} stroke="#fff" strokeWidth={2}>
              {data.map((_, i) => <Cell key={i} fill={CAT[i % CAT.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number, n) => [formatINR(v), n as string]} contentStyle={tip} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="flex-1 space-y-1.5 text-sm">
          {data.map((d, i) => (
            <li key={d.method} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CAT[i % CAT.length] }} />
              <span className="flex-1 text-gray-600">{PAY_LABEL[d.method] ?? d.method}</span>
              <span className="font-medium">{total ? Math.round((d.total / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

/** Sales by category — horizontal bar (ranked comparison). */
export function CategoryBar({ data }: { data: { category: string; total: number }[] }) {
  return (
    <Card title="Sales by category" subtitle="Top 3 this month" empty={data.length === 0}>
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 38)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="category" tickLine={false} axisLine={false} width={90} tick={axisTick} />
          <Tooltip formatter={(v: number) => [formatINR(v), "Sales"]} contentStyle={tip} cursor={{ fill: "#f9fafb" }} />
          <Bar dataKey="total" fill={PRIMARY} radius={[0, 4, 4, 0]} maxBarSize={22}>
            <LabelList dataKey="total" position="right" formatter={(v: number) => axisMoney(v)} style={{ fill: "#6b7280", fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

/** Peak hours — vertical bars (when the shop is busiest). */
export function HoursBar({ data }: { data: { label: string; total: number }[] }) {
  return (
    <Card title="Busiest hours" subtitle="Last 7 days" empty={data.length === 0}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
          <YAxis tickLine={false} axisLine={false} width={48} tick={axisTick} tickFormatter={axisMoney} />
          <Tooltip formatter={(v: number) => [formatINR(v), "Sales"]} contentStyle={tip} cursor={{ fill: "#f9fafb" }} />
          <Bar dataKey="total" fill={PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
