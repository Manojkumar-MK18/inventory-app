"use client";

import {
  Bar, BarChart, Cell, Pie, PieChart,
  CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList,
} from "recharts";
import { formatINR } from "@/lib/money";

const CAT = ["#2a78d6", "#008300", "#e87ba4", "#eda100", "#1baf7a", "#eb6834"];
const PRIMARY = "#2a78d6";
const PAY_LABEL: Record<string, string> = { CASH: "Cash", UPI: "UPI", CARD: "Card", CREDIT: "Due" };

const axisMoney = (v: number) =>
  v >= 10000000 ? `₹${(v / 10000000).toFixed(1)}Cr` : v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${Math.round(v / 100)}`;
const tip = { borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 } as const;
const axisTick = { fill: "#9ca3af", fontSize: 11 } as const;

function Card({ title, subtitle, empty, children }: { title: string; subtitle?: string; empty?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="mb-2 text-xs text-gray-400">{subtitle}</p>}
      {empty ? <div className="flex h-56 items-center justify-center text-sm text-gray-400">No sales in this period.</div> : <div className="mt-3">{children}</div>}
    </div>
  );
}

/** Day-by-day sales over the chosen period. */
export function DailySalesChart({ data }: { data: { label: string; total: number }[] }) {
  return (
    <Card title="Sales each day" subtitle="How much you sold on each day" empty={data.length === 0}>
      <ResponsiveContainer width="100%" height={224}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} width={48} tick={axisTick} tickFormatter={axisMoney} />
          <Tooltip formatter={(v: number) => [formatINR(v), "Sales"]} contentStyle={tip} cursor={{ fill: "#f9fafb" }} />
          <Bar dataKey="total" fill={PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={38} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

/** Money in vs money out — a simple visual of where money went. */
export function MoneyFlowChart({ totalSales, costOfGoods, expenses, netProfit }: { totalSales: number; costOfGoods: number; expenses: number; netProfit: number }) {
  const data = [
    { name: "Sales", value: totalSales, fill: "#008300" },
    { name: "Goods cost", value: costOfGoods, fill: "#eda100" },
    { name: "Expenses", value: expenses, fill: "#eb6834" },
    { name: "Final profit", value: netProfit, fill: netProfit >= 0 ? "#2a78d6" : "#dc2626" },
  ];
  const empty = totalSales === 0 && costOfGoods === 0 && expenses === 0;
  return (
    <Card title="Where your money went" subtitle="Sales, costs and what you kept" empty={empty}>
      <ResponsiveContainer width="100%" height={224}>
        <BarChart data={data} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} />
          <YAxis tickLine={false} axisLine={false} width={48} tick={axisTick} tickFormatter={axisMoney} />
          <Tooltip formatter={(v: number) => [formatINR(v), "Amount"]} contentStyle={tip} cursor={{ fill: "#f9fafb" }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
            <LabelList dataKey="value" position="top" formatter={(v: number) => axisMoney(v)} style={{ fill: "#6b7280", fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

/** Best-selling products by money earned (ranked bar). */
export function BestSellersChart({ data }: { data: { name: string; revenue: number }[] }) {
  const top = data.slice(0, 6);
  return (
    <Card title="Best selling products" subtitle="Money earned by each product" empty={top.length === 0}>
      <ResponsiveContainer width="100%" height={Math.max(160, top.length * 40)}>
        <BarChart data={top} layout="vertical" margin={{ top: 4, right: 52, left: 8, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={100} tick={axisTick} />
          <Tooltip formatter={(v: number) => [formatINR(v), "Earned"]} contentStyle={tip} cursor={{ fill: "#f9fafb" }} />
          <Bar dataKey="revenue" fill={PRIMARY} radius={[0, 4, 4, 0]} maxBarSize={24}>
            <LabelList dataKey="revenue" position="right" formatter={(v: number) => axisMoney(v)} style={{ fill: "#6b7280", fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

/** How customers paid — donut with a labelled legend. */
export function PaymentChart({ data }: { data: { method: string; total: number }[] }) {
  const total = data.reduce((a, d) => a + d.total, 0);
  return (
    <Card title="How customers paid" subtitle="Cash, UPI or card" empty={data.length === 0}>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width="55%" height={180}>
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="method" innerRadius={45} outerRadius={75} paddingAngle={2} stroke="#fff" strokeWidth={2}>
              {data.map((_, i) => <Cell key={i} fill={CAT[i % CAT.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number, n) => [formatINR(v), PAY_LABEL[n as string] ?? (n as string)]} contentStyle={tip} />
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
