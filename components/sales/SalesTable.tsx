"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Download, Printer } from "lucide-react";
import { getSale, type SaleListRow, type SavedSale } from "@/actions/sales";
import { formatINR } from "@/lib/money";
import { downloadCsv, paiseToCsv } from "@/lib/csv";
import { Receipt } from "@/components/invoice/Receipt";

export function SalesTable({ rows, businessName, gstin }: { rows: SaleListRow[]; businessName: string; gstin: string | null }) {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [viewing, setViewing] = useState<SavedSale | null>(null);
  const [pending, start] = useTransition();

  function openSale(id: string) {
    start(async () => {
      const sale = await getSale(id);
      if (sale) setViewing(sale);
    });
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const fromT = from ? new Date(from + "T00:00:00").getTime() : -Infinity;
    const toT = to ? new Date(to + "T23:59:59").getTime() : Infinity;
    return rows.filter((s) => {
      const t = new Date(s.date).getTime();
      if (t < fromT || t > toT) return false;
      if (!query) return true;
      return s.invoiceNo.toLowerCase().includes(query)
        || (s.customerName ?? "").toLowerCase().includes(query)
        || s.itemText.includes(query); // product name OR code
    });
  }, [rows, q, from, to]);

  const total = filtered.reduce((a, s) => a + (s.status === "ISSUED" ? s.grandTotal : 0), 0);

  function exportCsv() {
    downloadCsv(
      "sales.csv",
      ["Invoice", "Date", "Customer", "Items", "Discount (INR)", "Total (INR)", "Payment", "Cash received (INR)", "Returned (INR)", "Due at billing (INR)", "Pending now (INR)", "Billed by", "Status"],
      filtered.map((s) => [
        s.invoiceNo,
        new Date(s.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }),
        s.customerName ?? "Walk-in",
        s.itemCount,
        paiseToCsv(s.discount),
        paiseToCsv(s.grandTotal),
        payLabel(s.paymentMethod),
        s.cashReceived > 0 ? paiseToCsv(s.cashReceived) : "",
        s.change > 0 ? paiseToCsv(s.change) : "",
        s.dueAtBilling > 0 ? paiseToCsv(s.dueAtBilling) : "",
        s.dueNow > 0 ? paiseToCsv(s.dueNow) : "",
        s.billedBy ?? "",
        s.status,
      ])
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice, customer, product or code…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm" />
        </div>
        <label className="flex flex-col gap-1 text-xs text-gray-500">From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
        {(q || from || to) && (
          <button onClick={() => { setQ(""); setFrom(""); setTo(""); }} className="rounded-lg border px-3 py-2 text-sm">Clear</button>
        )}
        <button onClick={exportCsv} disabled={filtered.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">
          <Download size={15} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Bills" value={String(filtered.length)} />
        <Stat label="Total value" value={formatINR(total)} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full min-w-[920px] table-fixed text-sm">
          <colgroup>
            <col className="w-[150px]" />{/* Invoice */}
            <col className="w-[160px]" />{/* Date */}
            <col className="w-[130px]" />{/* Customer */}
            <col className="w-[70px]" />{/* Items */}
            <col className="w-[110px]" />{/* Discount */}
            <col className="w-[110px]" />{/* Total */}
            <col className="w-[150px]" />{/* Payment */}
            <col className="w-[120px]" />{/* Billed by */}
            <col className="w-[100px]" />{/* Status */}
            <col className="w-[80px]" />{/* View */}
          </colgroup>
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3 text-right">Items</th>
              <th className="px-4 py-3 text-right">Discount</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Billed by</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">No bills match.</td></tr>
            )}
            {filtered.map((s) => (
              <tr key={s.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openSale(s.id)}>
                <td className="truncate px-4 py-3 align-middle font-medium">{s.invoiceNo}</td>
                <td className="whitespace-nowrap px-4 py-3 align-middle text-gray-500">{new Date(s.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="truncate px-4 py-3 align-middle">{s.customerName ?? <span className="text-gray-400">Walk-in</span>}</td>
                <td className="px-4 py-3 align-middle text-right tabular-nums">{s.itemCount}</td>
                <td className="px-4 py-3 align-middle text-right tabular-nums">{s.discount > 0 ? <span className="font-medium text-green-700">− {formatINR(s.discount)}</span> : <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 align-middle text-right font-medium tabular-nums">{formatINR(s.grandTotal)}</td>
                <td className="px-4 py-3 align-middle">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{payLabel(s.paymentMethod)}</span>
                  {s.cashReceived > 0 && (
                    <div className="mt-0.5 text-[11px] text-gray-400">
                      Got {formatINR(s.cashReceived)}{s.change > 0 ? ` · Ret ${formatINR(s.change)}` : ""}
                    </div>
                  )}
                  {s.dueNow > 0 ? (
                    <div className="mt-0.5 text-[11px] font-medium text-red-500">
                      Pending {formatINR(s.dueNow)}
                      {s.dueNow !== s.dueAtBilling && <span className="text-gray-400"> (was {formatINR(s.dueAtBilling)})</span>}
                    </div>
                  ) : s.dueAtBilling > 0 ? (
                    <div className="mt-0.5 text-[11px] font-medium text-green-600">Due cleared</div>
                  ) : null}
                </td>
                <td className="truncate px-4 py-3 align-middle">{s.billedBy ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 align-middle">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.status === "ISSUED" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{s.status}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-middle text-right text-gray-400">{pending ? "…" : "View ›"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewing(null)}>
          <div className="flex max-h-[90vh] flex-col items-center gap-3 overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="no-print flex gap-2">
              <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm text-white">
                <Printer size={15} /> Print
              </button>
              <button onClick={() => setViewing(null)} className="rounded-lg border bg-white px-4 py-2 text-sm">Close</button>
            </div>
            <div className="rounded-xl bg-white shadow">
              <Receipt sale={viewing} businessName={businessName} gstin={gstin} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function payLabel(m: string): string {
  return m === "CREDIT" ? "Due" : m === "CASH" ? "Cash" : m === "CARD" ? "Card" : m;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
