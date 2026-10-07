"use client";

import { useState, useTransition } from "react";
import { TrendingUp, IndianRupee, Receipt, Boxes, Wallet, Download } from "lucide-react";
import { getReport, getFullReport, type ReportData } from "@/actions/reports";
import { formatINR } from "@/lib/money";
import { printReportPdf } from "@/lib/reportPdf";
import { DailySalesChart, MoneyFlowChart, BestSellersChart, PaymentChart } from "@/components/reports/ReportCharts";

export function ReportView({ initial }: { initial: ReportData }) {
  const [data, setData] = useState(initial);
  const [from, setFrom] = useState(initial.from.slice(0, 10));
  const [to, setTo] = useState(initial.to.slice(0, 10));
  const [pending, start] = useTransition();
  const [downloading, setDownloading] = useState(false);

  function run() {
    start(async () => setData(await getReport(from, to)));
  }

  async function downloadFull() {
    setDownloading(true);
    try {
      const r = await getFullReport(from, to);
      printReportPdf(r);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-xs text-gray-500">From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
        <button onClick={run} disabled={pending} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Loading…" : "Apply"}
        </button>
        <button onClick={downloadFull} disabled={downloading}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-50">
          <Download size={16} /> {downloading ? "Preparing…" : "Download PDF report"}
        </button>
      </div>

      {/* Money cards — plain words */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={<IndianRupee size={18} />} tone="green" label="Total sales" value={formatINR(data.totalSales)} sub={`${data.billCount} bill${data.billCount === 1 ? "" : "s"} · money from selling`} />
        <Stat icon={<Boxes size={18} />} tone="slate" label="Cost of goods sold" value={formatINR(data.costOfGoods)} sub="buy-price of only the items you sold" />
        <Stat icon={<TrendingUp size={18} />} tone={data.grossProfit >= 0 ? "indigo" : "red"} label="Profit from sales" value={formatINR(data.grossProfit)} sub="sales − cost of goods" />
        <Stat icon={<Wallet size={18} />} tone="slate" label="Other expenses" value={formatINR(data.expenses)} sub="rent, electricity, salary…" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={<Receipt size={18} />} tone={data.netProfit >= 0 ? "green" : "red"} label="Final profit" value={formatINR(data.netProfit)} sub="profit from sales − expenses" />
        <Stat icon={<Wallet size={18} />} tone="slate" label="Discount given" value={formatINR(data.totalDiscount)} sub="total discount to customers" />
        <Stat icon={<Boxes size={18} />} tone="slate" label="Stock value now" value={formatINR(data.stockValue)} sub="worth of unsold goods in your shop" />
        {data.usesGst && (
          <Stat icon={<Receipt size={18} />} tone="slate" label="GST collected" value={formatINR(data.gstCollected)} sub="tax to pay the government" />
        )}
      </div>

      {/* Plain-language explainer — how the profit is worked out, step by step */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm">
        <p className="mb-1 font-semibold text-gray-700">How your profit is counted</p>
        <p className="mb-3 text-xs text-gray-400">Start with the money you got, take away your costs. What is left is your profit.</p>
        <div className="flex flex-col gap-2 text-gray-600">
          {data.totalDiscount > 0 && (
            <>
              <Row n="1" a="Price of goods you sold (before discount)" b={formatINR(data.totalSales + data.totalDiscount)} />
              <Row n="−" a="Discount you gave to customers" b={`− ${formatINR(data.totalDiscount)}`} tone="green" />
              <Row n="=" a="Money you got (Total sales)" b={formatINR(data.totalSales)} strong />
            </>
          )}
          {data.totalDiscount === 0 && (
            <Row n="1" a="Money you got from selling (Total sales)" b={formatINR(data.totalSales)} />
          )}
          {data.usesGst && (
            <Row n="−" a="GST you collected (you pay this to the government)" b={`− ${formatINR(data.gstCollected)}`} />
          )}
          <Row n="−" a="Cost of the goods you sold (what YOU paid to buy them)" b={`− ${formatINR(data.costOfGoods)}`} />
          {data.costOfGoods > data.totalSales && (
            <p className="pl-7 text-xs text-red-500">
              You bought these goods for <b>{formatINR(data.costOfGoods)}</b> but sold them for only <b>{formatINR(data.totalSales)}</b> — the buy price is higher than the selling price, so there is a loss.
            </p>
          )}
          <div className="my-0.5 border-t border-gray-200" />
          <Row n="=" a="Profit from selling goods" b={formatINR(data.grossProfit)} strong tone={data.grossProfit >= 0 ? "green" : "red"} />
          <Row n="−" a="Other shop expenses (rent, electricity, salary…)" b={`− ${formatINR(data.expenses)}`} />
          <div className="my-0.5 border-t-2 border-gray-300" />
          <Row n="=" a="Final profit you kept" b={formatINR(data.netProfit)} strong big tone={data.netProfit >= 0 ? "green" : "red"} />
        </div>
        {data.netProfit >= 0 ? (
          <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
            Good — after all costs you kept <b>{formatINR(data.netProfit)}</b> in this period.
          </p>
        ) : (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            You are in a loss of <b>{formatINR(-data.netProfit)}</b> this period — your costs are more than your sales.
            {data.grossProfit < 0 && " The goods are being sold for less than they cost you — raise your selling price, or check the buy cost on the Purchase screen."}
            {data.grossProfit >= 0 && data.expenses > 0 && " Your selling is fine, but the other expenses are bigger than the profit from goods."}
          </p>
        )}
        {data.costOfGoods === 0 && data.totalSales > 0 && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Note: no buy cost is saved for these items, so the profit may not be exact. Add items through the Purchase screen with their buy cost for correct profit.
          </p>
        )}
      </div>

      {/* Charts — visual, easy to read */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DailySalesChart data={data.dailySales} />
        <MoneyFlowChart totalSales={data.totalSales} costOfGoods={data.costOfGoods} expenses={data.expenses} netProfit={data.netProfit} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BestSellersChart data={data.topProducts} />
        <PaymentChart data={data.paymentMix} />
      </div>

      {/* Best sellers — plain, always useful */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">Best selling products</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500"><th className="py-2">Product</th><th className="text-right">Qty sold</th><th className="text-right">Money earned</th></tr></thead>
          <tbody>
            {data.topProducts.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-gray-400">No sales in this period.</td></tr>}
            {data.topProducts.map((t) => (
              <tr key={t.name} className="border-b last:border-0">
                <td className="py-2">{t.name}</td>
                <td className="text-right tabular-nums">{t.qty}</td>
                <td className="text-right tabular-nums">{formatINR(t.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* GST details — only for GST-registered shops */}
      {data.usesGst && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">GST summary by rate</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500"><th className="py-2">Rate</th><th className="text-right">Taxable</th><th className="text-right">Tax</th></tr></thead>
            <tbody>
              {data.gstByRate.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-gray-400">No data.</td></tr>}
              {data.gstByRate.map((r) => (
                <tr key={r.rate} className="border-b last:border-0">
                  <td className="py-2">{r.rate}%</td>
                  <td className="text-right tabular-nums">{formatINR(r.taxable)}</td>
                  <td className="text-right tabular-nums">{formatINR(r.tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ n, a, b, strong, big, tone }: { n?: string; a: string; b: string; strong?: boolean; big?: boolean; tone?: "green" | "red" }) {
  const color = tone === "green" ? "text-green-700" : tone === "red" ? "text-red-600" : "";
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? "font-semibold" : ""} ${big ? "text-base" : ""} ${color}`}>
      <span className="flex items-center gap-2">
        {n && <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-xs ${strong ? "bg-gray-200 text-gray-600" : "text-gray-300"}`}>{n}</span>}
        <span>{a}</span>
      </span>
      <span className="tabular-nums whitespace-nowrap">{b}</span>
    </div>
  );
}

const TONES: Record<string, string> = {
  green: "bg-green-50 text-green-600",
  indigo: "bg-indigo-50 text-indigo-600",
  slate: "bg-gray-100 text-gray-600",
  red: "bg-red-50 text-red-600",
};

function Stat({ icon, label, value, sub, tone = "slate" }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
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
