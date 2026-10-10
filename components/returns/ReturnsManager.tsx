"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, RotateCcw, Check, Repeat, AlertTriangle, Trash2 } from "lucide-react";
import { findSaleForReturn, createReturn, createExchange, type SaleForReturn, type ReturnListRow } from "@/actions/returns";
import type { ProductDTO } from "@/actions/products";
import { formatINR, toPaise, toRupees } from "@/lib/money";

type Kind = "RETURN" | "EXCHANGE" | "DAMAGE";
interface NewLine { product: ProductDTO; variantLabel?: string; qty: number; priceRupees: number }
const nKey = (id: string, v?: string) => `${id}::${v ?? ""}`;

export function ReturnsManager({ initialReturns, products }: { initialReturns: ReturnListRow[]; products: ProductDTO[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState("");
  const [sale, setSale] = useState<SaleForReturn | null>(null);
  const [qtys, setQtys] = useState<Record<number, number>>({});
  const [kind, setKind] = useState<Kind>("RETURN");
  const [method, setMethod] = useState<"CASH" | "UPI" | "CARD" | "ADJUST_DUES">("CASH");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Exchange: the new products the customer takes
  const [newCart, setNewCart] = useState<NewLine[]>([]);
  const [prodSearch, setProdSearch] = useState("");

  async function find() {
    setError(""); setDone(null); setSale(null); setQtys({}); setNewCart([]);
    const q = query.trim();
    if (!q) return;
    setFinding(true);
    const res = await findSaleForReturn(q);
    setFinding(false);
    if (!res.ok) return setError(res.error);
    setSale(res.sale);
    setMethod("CASH");
  }

  const returnCredit = sale ? sale.lines.reduce((a, l) => a + (qtys[l.lineIndex] || 0) * l.refundPerUnit, 0) : 0;
  const anyReturnSelected = sale?.lines.some((l) => (qtys[l.lineIndex] || 0) > 0) ?? false;

  // ---- exchange new-item search (one entry per size) ----
  const matches = useMemo(() => {
    const qq = prodSearch.trim().toLowerCase();
    if (!qq) return [] as { product: ProductDTO; variantLabel?: string; price: number }[];
    const out: { product: ProductDTO; variantLabel?: string; price: number }[] = [];
    for (const p of products) {
      const hit = p.name.toLowerCase().includes(qq) || p.sku.toLowerCase().includes(qq);
      if (p.variants.length > 0) {
        for (const v of p.variants) if (hit || (v.barcode ?? "").toLowerCase() === qq) out.push({ product: p, variantLabel: v.label, price: v.price ?? p.salePrice });
      } else if (hit || (p.barcode ?? "").toLowerCase() === qq) out.push({ product: p, price: p.salePrice });
      if (out.length >= 10) break;
    }
    return out;
  }, [prodSearch, products]);

  function addNew(e: { product: ProductDTO; variantLabel?: string; price: number }) {
    const k = nKey(e.product.id, e.variantLabel);
    setNewCart((c) => {
      const i = c.findIndex((x) => nKey(x.product.id, x.variantLabel) === k);
      if (i >= 0) { const n = [...c]; n[i] = { ...n[i], qty: n[i].qty + 1 }; return n; }
      return [...c, { product: e.product, variantLabel: e.variantLabel, qty: 1, priceRupees: toRupees(e.price) }];
    });
    setProdSearch("");
  }
  const patchNew = (k: string, p: Partial<NewLine>) => setNewCart((c) => c.map((x) => nKey(x.product.id, x.variantLabel) === k ? { ...x, ...p } : x));
  const removeNew = (k: string) => setNewCart((c) => c.filter((x) => nKey(x.product.id, x.variantLabel) !== k));

  const newTotal = newCart.reduce((a, l) => a + Math.round(l.qty * l.priceRupees * 100), 0);
  const net = newTotal - returnCredit; // >0 customer pays, <0 refund to customer

  async function process() {
    if (!sale) return;
    setError("");
    const lines = sale.lines.map((l) => ({ lineIndex: l.lineIndex, qty: qtys[l.lineIndex] || 0 })).filter((l) => l.qty > 0);
    if (lines.length === 0) return setError("Enter how many items to return");

    setSaving(true);
    if (kind === "EXCHANGE") {
      if (newCart.length === 0) { setSaving(false); return setError("Add the new product(s) the customer is taking"); }
      const res = await createExchange({
        saleId: sale.saleId,
        returnLines: lines,
        newItems: newCart.map((l) => ({ productId: l.product.id, variantLabel: l.variantLabel, qty: l.qty, priceRupees: l.priceRupees })),
        paymentMethod: method === "ADJUST_DUES" ? "CASH" : method,
      });
      setSaving(false);
      if (!res.ok) return setError(res.error);
      setDone(`Exchange done — new bill ${res.newInvoiceNo}. ${res.net >= 0 ? `Collect ${formatINR(res.net)} from customer.` : `Refund ${formatINR(-res.net)} to customer.`}`);
    } else {
      const res = await createReturn({ saleId: sale.saleId, lines, kind, refundMethod: method });
      setSaving(false);
      if (!res.ok) return setError(res.error);
      setDone(kind === "DAMAGE"
        ? `Marked as damaged — ${res.returnNo}. Refunded ${formatINR(res.totalRefund)}. Items are NOT back in sellable stock.`
        : `Return ${res.returnNo} done — refunded ${formatINR(res.totalRefund)}. Stock added back.`);
    }
    setSale(null); setQtys({}); setNewCart([]); setQuery(""); setKind("RETURN");
    router.refresh();
    searchRef.current?.focus();
  }

  const KINDS: { key: Kind; label: string; icon: any; hint: string }[] = [
    { key: "RETURN", label: "Return", icon: RotateCcw, hint: "Money back · item goes back to stock" },
    { key: "EXCHANGE", label: "Exchange", icon: Repeat, hint: "Give a new product · pay the difference" },
    { key: "DAMAGE", label: "Damage", icon: AlertTriangle, hint: "Refund · item written off (not resold)" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Find the bill */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
        <h2 className="mb-1 font-semibold">Find the bill</h2>
        <p className="mb-3 text-sm text-gray-500">Scan the item barcode, or type the bill (invoice) number, then press Enter.</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input ref={searchRef} autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") find(); }}
              placeholder="Scan barcode or type invoice no…" className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm" />
          </div>
          <button onClick={find} disabled={finding} className="rounded-xl bg-gray-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{finding ? "Finding…" : "Find bill"}</button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {done && <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"><Check size={16} /> {done}</div>}
      </div>

      {sale && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
          <div className="mb-3">
            <p className="font-semibold">Bill {sale.invoiceNo}</p>
            <p className="text-xs text-gray-400">{new Date(sale.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}{sale.customerName ? ` · ${sale.customerName}` : " · Walk-in"}</p>
          </div>

          {/* Type selector */}
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {KINDS.map((k) => {
              const active = kind === k.key;
              const Icon = k.icon;
              return (
                <button key={k.key} type="button" onClick={() => setKind(k.key)}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left ${active ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:bg-gray-50"}`}>
                  <span className={`flex items-center gap-1.5 text-sm font-semibold ${active ? "text-brand-700" : "text-gray-700"}`}><Icon size={15} /> {k.label}</span>
                  <span className="text-[11px] text-gray-500">{k.hint}</span>
                </button>
              );
            })}
          </div>

          {/* Items to return */}
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Items coming back</p>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <tr><th className="px-4 py-3">Item</th><th className="px-4 py-3 text-right">Bought</th><th className="px-4 py-3 text-right">Returned</th><th className="px-4 py-3 text-right">Value / pc</th><th className="px-4 py-3 text-center">Qty</th><th className="px-4 py-3 text-right">Credit</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sale.lines.map((l) => {
                  const q = qtys[l.lineIndex] || 0; const disabled = l.qtyLeft <= 0;
                  return (
                    <tr key={l.lineIndex} className={disabled ? "opacity-50" : ""}>
                      <td className="px-4 py-3 font-medium">{l.name}{disabled && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">all returned</span>}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{l.qtyBought}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{l.qtyReturned}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatINR(l.refundPerUnit)}</td>
                      <td className="px-4 py-3 text-center">
                        <input type="number" min={0} max={l.qtyLeft} value={q || ""} placeholder="0" disabled={disabled}
                          onFocus={(e) => e.currentTarget.select()}
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

          {/* EXCHANGE: new products the customer takes */}
          {kind === "EXCHANGE" && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">New product(s) the customer takes</p>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={prodSearch} onChange={(e) => setProdSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) { e.preventDefault(); addNew(matches[0]); } }}
                  placeholder="Search product to add…" className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm" />
                {matches.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border bg-white shadow">
                    {matches.map((e) => (
                      <button key={nKey(e.product.id, e.variantLabel)} onClick={() => addNew(e)} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-gray-100">
                        <span>{e.product.name}{e.variantLabel && <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium">{e.variantLabel}</span>} <span className="text-gray-400">({e.product.sku})</span></span>
                        <span>{formatINR(e.price)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {newCart.length > 0 && (
                <div className="mt-2 overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 w-20">Price ₹</th><th className="px-3 py-2 w-16">Qty</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2" /></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {newCart.map((l) => {
                        const k = nKey(l.product.id, l.variantLabel);
                        return (
                          <tr key={k}>
                            <td className="px-3 py-2 font-medium">{l.product.name}{l.variantLabel && <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">{l.variantLabel}</span>}</td>
                            <td className="px-3 py-2"><input type="number" min={0} step="0.01" value={l.priceRupees || ""} placeholder="0" onFocus={(e) => e.currentTarget.select()} onChange={(e) => patchNew(k, { priceRupees: Math.max(0, Number(e.target.value)) })} className="h-8 w-20 rounded border px-2" /></td>
                            <td className="px-3 py-2"><input type="number" min={1} value={l.qty} onFocus={(e) => e.currentTarget.select()} onChange={(e) => patchNew(k, { qty: Math.max(1, Number(e.target.value)) })} className="h-8 w-16 rounded border px-2" /></td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">{formatINR(Math.round(l.qty * l.priceRupees * 100))}</td>
                            <td className="px-3 py-2 text-right"><button onClick={() => removeNew(k)} className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Footer: payment + totals */}
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">{kind === "EXCHANGE" ? "Net paid / refunded by" : "Refund by"}</p>
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-gray-100 p-1">
                {(["CASH", "UPI", "CARD"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMethod(m)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${method === m ? "bg-white shadow" : "text-gray-500"}`}>{m}</button>
                ))}
                {kind !== "EXCHANGE" && (
                  <button type="button" disabled={!sale.hasCustomer} onClick={() => setMethod("ADJUST_DUES")} title={sale.hasCustomer ? "Reduce what the customer owes" : "No customer on this bill"}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${method === "ADJUST_DUES" ? "bg-white shadow" : "text-gray-500"}`}>Dues</button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right text-sm">
                {kind === "EXCHANGE" ? (
                  <>
                    <p className="text-gray-500">Return credit <b className="text-gray-800">{formatINR(returnCredit)}</b> · New items <b className="text-gray-800">{formatINR(newTotal)}</b></p>
                    <p className={`text-lg font-bold ${net >= 0 ? "text-gray-900" : "text-emerald-700"}`}>{net >= 0 ? `Customer pays ${formatINR(net)}` : `Refund ${formatINR(-net)}`}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs uppercase tracking-wide text-gray-400">{kind === "DAMAGE" ? "Refund (item written off)" : "Total refund"}</p>
                    <p className="text-2xl font-bold">{formatINR(returnCredit)}</p>
                  </>
                )}
              </div>
              <button onClick={process} disabled={saving || !anyReturnSelected}
                className={`flex items-center gap-2 rounded-xl px-5 py-3 text-base font-semibold text-white disabled:opacity-50 ${kind === "DAMAGE" ? "bg-red-600" : kind === "EXCHANGE" ? "bg-brand-600" : "bg-emerald-600"}`}>
                {kind === "DAMAGE" ? <AlertTriangle size={18} /> : kind === "EXCHANGE" ? <Repeat size={18} /> : <RotateCcw size={18} />}
                {saving ? "Processing…" : kind === "DAMAGE" ? "Mark damaged" : kind === "EXCHANGE" ? "Do exchange" : "Process return"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent returns */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr><th className="px-4 py-3">No.</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Original bill</th><th className="px-4 py-3">New bill</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3 text-right">Items</th><th className="px-4 py-3 text-right">Refund</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {initialReturns.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No returns yet.</td></tr>}
            {initialReturns.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{r.returnNo}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.kind === "DAMAGE" ? "bg-red-50 text-red-600" : r.kind === "EXCHANGE" ? "bg-brand-50 text-brand-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {r.kind === "DAMAGE" ? "Damage" : r.kind === "EXCHANGE" ? "Exchange" : "Return"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(r.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="px-4 py-3 text-gray-500">{r.originalInvoiceNo}</td>
                <td className="px-4 py-3 text-gray-500">{r.exchangeInvoiceNo || "—"}</td>
                <td className="px-4 py-3">{r.customerName ?? <span className="text-gray-400">Walk-in</span>}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.itemCount}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{formatINR(r.totalRefund)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
