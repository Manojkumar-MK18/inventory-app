"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, RotateCcw, Check } from "lucide-react";
import { findSaleForReturn, createReturn, type SaleForReturn, type ReturnListRow } from "@/actions/returns";
import { formatINR } from "@/lib/money";

export function ReturnsManager({ initialReturns }: { initialReturns: ReturnListRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState("");
  const [sale, setSale] = useState<SaleForReturn | null>(null);
  const [qtys, setQtys] = useState<Record<number, number>>({});
  const [method, setMethod] = useState<"CASH" | "UPI" | "CARD" | "ADJUST_DUES">("CASH");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ returnNo: string; totalRefund: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  async function find() {
    setError(""); setDone(null); setSale(null); setQtys({});
    const q = query.trim();
    if (!q) return;
    setFinding(true);
    const res = await findSaleForReturn(q);
    setFinding(false);
    if (!res.ok) return setError(res.error);
    setSale(res.sale);
    setMethod(res.sale.hasCustomer ? "CASH" : "CASH");
  }

  const refundTotal = sale
    ? sale.lines.reduce((a, l) => a + (qtys[l.lineIndex] || 0) * l.refundPerUnit, 0)
    : 0;
  const anySelected = refundTotal > 0 || (sale?.lines.some((l) => (qtys[l.lineIndex] || 0) > 0) ?? false);

  async function process() {
    if (!sale) return;
    setError("");
    const lines = sale.lines.map((l) => ({ lineIndex: l.lineIndex, qty: qtys[l.lineIndex] || 0 })).filter((l) => l.qty > 0);
    if (lines.length === 0) return setError("Enter how many to return");
    setSaving(true);
    const res = await createReturn({ saleId: sale.saleId, lines, refundMethod: method });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setDone({ returnNo: res.returnNo, totalRefund: res.totalRefund });
    setSale(null); setQtys({}); setQuery("");
    router.refresh();
    searchRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Find the bill */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
        <h2 className="mb-1 font-semibold">Return an item</h2>
        <p className="mb-3 text-sm text-gray-500">Scan the item barcode, or type the bill (invoice) number, then press Enter.</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input ref={searchRef} autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") find(); }}
              placeholder="Scan barcode or type invoice no (e.g. INV/26-27/000008)…"
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm" />
          </div>
          <button onClick={find} disabled={finding} className="rounded-xl bg-gray-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {finding ? "Finding…" : "Find bill"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {done && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <Check size={16} /> Return {done.returnNo} done — refunded {formatINR(done.totalRefund)}. Stock added back.
          </div>
        )}
      </div>

      {/* The bill's items */}
      {sale && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">Bill {sale.invoiceNo}</p>
              <p className="text-xs text-gray-400">
                {new Date(sale.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                {sale.customerName ? ` · ${sale.customerName}` : " · Walk-in"}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 text-right">Bought</th>
                  <th className="px-4 py-3 text-right">Returned</th>
                  <th className="px-4 py-3 text-right">Refund / pc</th>
                  <th className="px-4 py-3 text-center">Return qty</th>
                  <th className="px-4 py-3 text-right">Refund</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sale.lines.map((l) => {
                  const q = qtys[l.lineIndex] || 0;
                  const disabled = l.qtyLeft <= 0;
                  return (
                    <tr key={l.lineIndex} className={disabled ? "opacity-50" : ""}>
                      <td className="px-4 py-3 font-medium">
                        {l.name}
                        {disabled && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">all returned</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{l.qtyBought}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{l.qtyReturned}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatINR(l.refundPerUnit)}</td>
                      <td className="px-4 py-3 text-center">
                        <input type="number" min={0} max={l.qtyLeft} value={q} disabled={disabled}
                          onChange={(e) => setQtys((s) => ({ ...s, [l.lineIndex]: Math.max(0, Math.min(l.qtyLeft, Number(e.target.value))) }))}
                          className="w-16 rounded border px-2 py-1 text-center disabled:bg-gray-100" />
                        <span className="ml-1 text-xs text-gray-400">/ {l.qtyLeft}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{q > 0 ? formatINR(q * l.refundPerUnit) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Refund by</p>
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-gray-100 p-1">
                {(["CASH", "UPI", "CARD"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMethod(m)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium ${method === m ? "bg-white shadow" : "text-gray-500"}`}>{m}</button>
                ))}
                <button type="button" disabled={!sale.hasCustomer} onClick={() => setMethod("ADJUST_DUES")}
                  title={sale.hasCustomer ? "Reduce what the customer owes" : "No customer on this bill"}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${method === "ADJUST_DUES" ? "bg-white shadow" : "text-gray-500"}`}>Dues</button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-gray-400">Total refund</p>
                <p className="text-2xl font-bold">{formatINR(refundTotal)}</p>
              </div>
              <button onClick={process} disabled={saving || !anySelected}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-base font-semibold text-white disabled:opacity-50">
                <RotateCcw size={18} /> {saving ? "Processing…" : "Process return"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent returns */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">Return no</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Original bill</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3 text-right">Items</th>
              <th className="px-4 py-3 text-right">Refund</th>
              <th className="px-4 py-3">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {initialReturns.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No returns yet.</td></tr>
            )}
            {initialReturns.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{r.returnNo}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(r.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="px-4 py-3 text-gray-500">{r.originalInvoiceNo}</td>
                <td className="px-4 py-3">{r.customerName ?? <span className="text-gray-400">Walk-in</span>}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.itemCount}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{formatINR(r.totalRefund)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{r.refundMethod === "ADJUST_DUES" ? "Dues" : r.refundMethod}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
