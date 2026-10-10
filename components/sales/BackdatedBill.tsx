"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Search, Trash2 } from "lucide-react";
import type { ProductDTO } from "@/actions/products";
import { createBackdatedSale } from "@/actions/sales";
import { computeBill, type GstType } from "@/lib/tax";
import { formatINR, toPaise, toRupees } from "@/lib/money";

interface Line { product: ProductDTO; variantLabel?: string; qty: number; priceRupees: number }
interface BEntry { product: ProductDTO; variantLabel?: string; price: number; stock: number }
const bKey = (id: string, v?: string) => `${id}::${v ?? ""}`;
const inputCls = "rounded-lg border border-gray-300 px-3 py-2 text-sm";

export function BackdatedBill({ products, gstType, pricesIncludeTax }: { products: ProductDTO[]; gstType: GstType; pricesIncludeTax: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium">
        <CalendarPlus size={16} /> Add past bill
      </button>
      {open && <Modal products={products} gstType={gstType} pricesIncludeTax={pricesIncludeTax} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); router.refresh(); }} />}
    </>
  );
}

function Modal({ products, gstType, pricesIncludeTax, onClose, onSaved }: { products: ProductDTO[]; gstType: GstType; pricesIncludeTax: boolean; onClose: () => void; onSaved: () => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [invoiceMode, setInvoiceMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [payMethod, setPayMethod] = useState<"CASH" | "UPI" | "CARD">("CASH");
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [idemKey] = useState(() => crypto.randomUUID());
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const matches = useMemo<BEntry[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: BEntry[] = [];
    for (const p of products) {
      const hit = p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      if (!hit) continue;
      if (p.variants.length > 0) p.variants.forEach((v) => out.push({ product: p, variantLabel: v.label, price: v.price ?? p.salePrice, stock: v.stock }));
      else out.push({ product: p, price: p.salePrice, stock: p.currentStock });
      if (out.length >= 10) break;
    }
    return out;
  }, [query, products]);

  function add(e: BEntry) {
    const k = bKey(e.product.id, e.variantLabel);
    setLines((l) => l.some((x) => bKey(x.product.id, x.variantLabel) === k) ? l : [...l, { product: e.product, variantLabel: e.variantLabel, qty: 1, priceRupees: toRupees(e.price) }]);
    setQuery("");
  }
  const patch = (k: string, p: Partial<Line>) => setLines((l) => l.map((x) => bKey(x.product.id, x.variantLabel) === k ? { ...x, ...p } : x));
  const remove = (k: string) => setLines((l) => l.filter((x) => bKey(x.product.id, x.variantLabel) !== k));

  const bill = useMemo(() => computeBill(
    lines.map((l) => ({ price: toPaise(l.priceRupees || 0), qty: l.qty, discount: 0, taxRate: l.product.taxRate })),
    { gstType, pricesIncludeTax, interState: false }
  ), [lines, gstType, pricesIncludeTax]);

  async function save() {
    if (lines.length === 0) return setError("Add at least one item");
    if (!date) return setError("Pick the bill date");
    setError(""); setSaving(true);
    const res = await createBackdatedSale({
      items: lines.map((l) => ({ productId: l.product.id, qty: l.qty, priceOverride: toPaise(l.priceRupees || 0), variantLabel: l.variantLabel })),
      idempotencyKey: idemKey,
      paymentMethod: payMethod,
      customer: { name: custName, phone: custPhone },
      dateYmd: date,
      invoiceMode,
      invoiceNo: invoiceMode === "MANUAL" ? invoiceNo : "",
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    alert(`Saved bill ${res.sale.invoiceNo}`);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-lg font-semibold">Add a past bill</h2>
        <p className="mb-4 text-sm text-gray-500">For a sale you forgot to bill. Pick its date and choose how to number it.</p>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Bill date</span>
            <input type="date" value={date} max={todayStr} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Invoice number</span>
            <div className="flex gap-2">
              <select value={invoiceMode} onChange={(e) => setInvoiceMode(e.target.value as any)} className={inputCls}>
                <option value="AUTO">Auto-generate</option>
                <option value="MANUAL">Enter manually</option>
              </select>
              {invoiceMode === "MANUAL" && (
                <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="e.g. INV/26-27/000045" className={`${inputCls} flex-1`} />
              )}
            </div>
          </label>
        </div>

        <div className="relative mt-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product to add…" className={`${inputCls} w-full pl-9`} />
          {matches.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-white shadow">
              {matches.map((e) => (
                <button type="button" key={bKey(e.product.id, e.variantLabel)} onClick={() => add(e)} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-gray-100">
                  <span>{e.product.name}{e.variantLabel && <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium">{e.variantLabel}</span>} <span className="text-gray-400">({e.product.sku})</span></span>
                  <span className="text-gray-400">{formatINR(e.price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <table className="mt-3 w-full text-sm">
          <thead><tr className="border-b text-left text-gray-500"><th className="py-2">Item</th><th>Qty</th><th>Price ₹</th><th className="text-right">Amount</th><th></th></tr></thead>
          <tbody>
            {lines.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400">No items added.</td></tr>}
            {lines.map((l, idx) => {
              const ln = bill.lines[idx];
              const amt = ln.taxable + ln.cgst + ln.sgst + ln.igst;
              const k = bKey(l.product.id, l.variantLabel);
              return (
                <tr key={k} className="border-b">
                  <td className="py-2">{l.product.name}{l.variantLabel && <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">{l.variantLabel}</span>}</td>
                  <td><input type="number" min={1} value={l.qty} onFocus={(e) => e.currentTarget.select()} onChange={(e) => patch(k, { qty: Math.max(1, Number(e.target.value)) })} className="w-16 rounded border px-2 py-1" /></td>
                  <td><input type="number" min={0} step="0.01" value={l.priceRupees || ""} placeholder="0" onFocus={(e) => e.currentTarget.select()} onChange={(e) => patch(k, { priceRupees: Math.max(0, Number(e.target.value)) })} className="w-24 rounded border px-2 py-1" /></td>
                  <td className="text-right">{formatINR(amt)}</td>
                  <td className="text-right"><button onClick={() => remove(k)} className="text-red-500"><Trash2 size={15} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span>{formatINR(bill.grandTotal)}</span></div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Payment</span>
            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as any)} className={inputCls}>
              <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Customer</span>
            <div className="flex gap-2">
              <input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Name" className={`${inputCls} w-1/2`} />
              <input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="Phone" className={`${inputCls} w-1/2`} />
            </div>
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? "Saving…" : "Save bill"}</button>
        </div>
      </div>
    </div>
  );
}
