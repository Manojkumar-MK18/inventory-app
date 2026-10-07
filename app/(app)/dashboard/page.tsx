import Link from "next/link";
import { IndianRupee, ShoppingCart, Plus, TrendingUp, Trophy, PackageX, RotateCcw } from "lucide-react";
import { getDashboardStats } from "@/actions/dashboard";
import { formatINR } from "@/lib/money";
import { TrendChart, PaymentDonut, CategoryBar, HoursBar } from "@/components/dashboard/Charts";

export default async function DashboardPage() {
  const s = await getDashboardStats();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-gray-400">An overview of your shop.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/pos" className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white">
            <ShoppingCart size={16} /> New bill
          </Link>
          <Link href="/products" className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium">
            <Plus size={16} /> Add product
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={<IndianRupee size={18} />} tone="green" label="Today's sales" value={formatINR(s.todaySales)}
          sub={`${s.todayBills} bill${s.todayBills === 1 ? "" : "s"}${s.todayReturns > 0 ? ` · ${formatINR(s.todayReturns)} returned` : " today"}`} />
        <Stat icon={<TrendingUp size={18} />} tone="indigo" label="This month" value={formatINR(s.monthSales)}
          sub={s.monthReturns > 0 ? `${formatINR(s.monthReturns)} returned this month` : "total sales"} />
        <Link href="/returns" className="block">
          <Stat icon={<RotateCcw size={18} />} tone={s.monthReturns > 0 ? "red" : "slate"} label="Returns (this month)" value={formatINR(s.monthReturns)} sub={`${formatINR(s.todayReturns)} today`} />
        </Link>
        <Link href="/products" className="block">
          <Stat icon={<PackageX size={18} />} tone={s.lowStock > 0 ? "amber" : "slate"} label="Low stock" value={String(s.lowStock)} sub={s.lowStock > 0 ? "items to buy soon" : "all stocked"} />
        </Link>
      </div>

      {/* Trend + payment mix */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3"><TrendChart data={s.trend14} /></div>
        <div className="lg:col-span-2"><PaymentDonut data={s.paymentMix} /></div>
      </div>

      {/* Hours + category */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HoursBar data={s.byHour} />
        <CategoryBar data={s.byCategory} />
      </div>

      {/* Top selling + restocking */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-amber-500" />
              <h2 className="font-semibold">Best selling (top 5)</h2>
            </div>
            <Link href="/products" className="text-sm text-gray-500 underline">See all</Link>
          </div>
          {s.topProducts.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No sales yet this month.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {s.topProducts.map((t, i) => (
                <li key={t.name} className="flex items-center gap-3 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">{i + 1}</span>
                  <span className="flex-1 truncate font-medium">{t.name}</span>
                  <span className="text-gray-400">{t.qty} sold</span>
                  <span className="w-24 text-right font-medium">{formatINR(t.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PackageX size={18} className="text-red-500" />
              <h2 className="font-semibold">Needs restocking</h2>
            </div>
            <Link href="/purchases" className="text-sm text-gray-500 underline">Purchase</Link>
          </div>
          {s.lowStockItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Everything is well stocked.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {s.lowStockItems.map((p) => (
                <li key={p.name} className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{p.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.currentStock === 0 ? "bg-red-100 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                    {p.currentStock === 0 ? "Out of stock" : `${p.currentStock} ${p.unit} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent bills */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Recent bills</h2>
          <Link href="/sales" className="text-sm text-gray-500 underline">View all</Link>
        </div>
        {s.recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No bills yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {s.recent.map((r) => (
              <li key={r.invoiceNo} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-medium">{r.invoiceNo}</span>
                <span className="text-xs text-gray-400">{new Date(r.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</span>
                <span className="font-medium">{formatINR(r.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  green: "bg-green-50 text-green-600",
  indigo: "bg-indigo-50 text-indigo-600",
  slate: "bg-gray-100 text-gray-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
};

function Stat({ icon, label, value, sub, tone = "slate" }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-card p-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONES[tone]}`}>{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-gray-400">{label}</p>
          <p className="text-xl font-semibold leading-tight">{value}</p>
        </div>
      </div>
      {sub && <p className="mt-2 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
