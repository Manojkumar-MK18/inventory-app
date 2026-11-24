"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, Trash2, Eye, X, Truck, Package, Check, Boxes,
} from "lucide-react";
import { createPurchase, deletePurchase, getPurchase, type PurchaseListRow, type PurchaseDetail } from "@/actions/purchases";
import { quickCreateProduct, type ProductDTO } from "@/actions/products";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const rs = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
const todayYmd = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD

const STATUS_BADGE: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-800",
  PARTIAL: "bg-amber-100 text-amber-800",
  UNPAID: "bg-red-100 text-red-700",
};

export function PurchasesView({
  products, purchases, supplierNames,
}: { products: ProductDTO[]; purchases: PurchaseListRow[]; supplierNames: string[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = purchases.filter((p) => {
    const q = query.trim().toLowerCase();
    return !q || p.supplierName.toLowerCase().includes(q) || p.supplierInvoiceNo.toLowerCase().includes(q) || p.itemText.includes(q);
  });

  async function onDelete(id: string) {
    if (!confirm("Delete this purchase? Its stock will be removed and supplier dues reversed.")) return;
    const r = await deletePurchase(id);
    if (!r.ok) return alert(r.error);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search supplier, invoice, item…"
            className="w-full rounded-full border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        </div>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-brand-700 hover:shadow-soft">
          <Plus size={16} /> New purchase
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-card">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3.5">Date</th>
              <th className="px-4 py-3.5">Supplier</th>
              <th className="px-4 py-3.5">Invoice</th>
              <th className="px-4 py-3.5 text-center">Items</th>
              <th className="px-4 py-3.5 text-right">Total</th>
              <th className="px-4 py-3.5 text-center">Payment</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                {purchases.length === 0 ? "No purchases yet. Record your first stock-in." : "No matches."}
              </td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50/60">
                <td className="px-4 py-3 text-gray-600">{new Date(p.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{p.supplierName || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.supplierInvoiceNo || "—"}</td>
                <td className="px-4 py-3 text-center text-gray-600">{p.itemCount}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{rs(p.totalCost)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[p.paymentStatus]}`}>
                    {p.paymentStatus === "PARTIAL" ? `Partial · ${rs(p.dueAmount)} due` : p.paymentStatus === "UNPAID" ? `Unpaid · ${rs(p.dueAmount)}` : "Paid"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => setViewId(p.id)} title="View" className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-brand-50 hover:text-brand-600"><Eye size={16} /></button>
                    <button onClick={() => onDelete(p.id)} title="Delete" className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && <PurchaseEntry products={products} supplierNames={supplierNames} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); router.refresh(); }} />}
      {viewId && <ViewModal id={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}

// ───────────────────────── Entry ─────────────────────────

type Line = { productId: string; name: string; brand: string; sku: string; variantLabel: string; qty: number; cost: number };

function PurchaseEntry({ products, supplierNames, onClose, onSaved }: {
  products: ProductDTO[]; supplierNames: string[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const [supplier, setSupplier] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayYmd());
  const [receivedDate, setReceivedDate] = useState(todayYmd());

  // item picker
  const [allProducts, setAllProducts] = useState<ProductDTO[]>(products);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<ProductDTO | null>(null);
  const [variant, setVariant] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  // quick-add new product (as a draft) — captures qty + cost so the line is complete
  const [quickOpen, setQuickOpen] = useState(false);
  const [qName, setQName] = useState("");
  const [qSku, setQSku] = useState("");
  const [qCat, setQCat] = useState("");
  const [qSizes, setQSizes] = useState("");
  const [qBuySize, setQBuySize] = useState("");
  const [qQty, setQQty] = useState("1");
  const [qCost, setQCost] = useState("");
  const [qSaving, setQSaving] = useState(false);
  const [qErr, setQErr] = useState("");
  const qSizeList = qSizes.split(",").map((s) => s.trim()).filter(Boolean);
  const tempIdRef = useRef(0);

  // charges + payment
  const [freight, setFreight] = useState("");
  const [discount, setDiscount] = useState("");
  const [status, setStatus] = useState<"PAID" | "PARTIAL" | "UNPAID">("PAID");
  const [paid, setPaid] = useState("");
  const [mode, setMode] = useState<"CASH" | "UPI" | "BANK" | "CHEQUE">("CASH");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return allProducts.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.brandName.toLowerCase().includes(q)).slice(0, 8);
  }, [search, allProducts]);

  function pick(p: ProductDTO) {
    setPicked(p);
    setSearch(`${p.name}${p.brandName ? ` · ${p.brandName}` : ""} · ${p.sku}`);
    setVariant(p.variants[0]?.label ?? "");
    setCost(p.costPrice ? String(Math.round(p.costPrice / 100)) : "");
  }

  function openQuickAdd() {
    setQName(search.trim()); setQSku(""); setQCat(""); setQSizes(""); setQBuySize("");
    setQQty("1"); setQCost(""); setQErr(""); setQuickOpen(true);
  }
  // "Add to purchase" only stages the new product + line on the FRONT-END.
  // Nothing is written to the database until "Save purchase".
  function saveQuickProduct() {
    setQErr("");
    if (qName.trim().length < 1) return setQErr("Enter a product name");
    if (qSku.trim().length < 1) return setQErr("Enter a SKU / item code");
    const sizes = qSizeList;
    const q = Number(qQty) || 0;
    const c = Number(qCost) || 0;
    if (q < 1) return setQErr("Enter the quantity you received");
    if (c <= 0) return setQErr("Enter the unit cost (price)");
    if (sizes.length > 0 && !qBuySize) return setQErr("Pick which size you're buying now");

    // SKU must be unique among products + other pending new ones.
    const sku = qSku.trim();
    if (allProducts.some((p) => p.sku.toLowerCase() === sku.toLowerCase())) {
      return setQErr("That SKU is already used — pick a different one");
    }

    const tempId = `new-${++tempIdRef.current}`;
    // A front-end-only draft so it's searchable for more size lines before saving.
    const pending: ProductDTO = {
      id: tempId, name: qName.trim(), sku, barcode: null, hsn: null, unit: "pcs",
      salePrice: 0, costPrice: c * 100, taxRate: 0, currentStock: 0, damagedStock: 0, minStock: 0,
      discount: 0, discountUnit: "₹", categoryName: qCat.trim(), brandName: "", department: "",
      description: "", fabric: "", imageUrl: "", mrp: null,
      variants: sizes.map((label) => ({ label, size: label, color: "", fit: "", barcode: "", stock: 0, minStock: 0, price: null, mrp: null, costPrice: null, locationCode: "" })),
      sellable: false,
    };
    setAllProducts((ps) => [pending, ...ps]);
    setLines((ls) => [...ls, {
      productId: tempId, name: pending.name, brand: "NEW", sku: pending.sku,
      variantLabel: sizes.length ? qBuySize : "", qty: q, cost: c * 100,
    }]);
    setQuickOpen(false);
    setSearch("");
    toast.info(`${pending.name} staged — saved when you click Save purchase`);
  }
  function addLine() {
    if (!picked) return setError("Pick a product first");
    if (picked.variants.length > 0 && !variant) return setError("Select a variant");
    const q = Number(qty) || 0;
    const c = Number(cost) || 0;
    if (q < 1) return setError("Enter a quantity");
    setError("");
    setLines((ls) => [...ls, { productId: picked.id, name: picked.name, brand: picked.brandName, sku: picked.sku, variantLabel: picked.variants.length > 0 ? variant : "", qty: q, cost: c * 100 }]);
    setPicked(null); setSearch(""); setVariant(""); setQty("1"); setCost("");
  }
  function removeLine(i: number) { setLines((ls) => ls.filter((_, idx) => idx !== i)); }

  const subtotal = lines.reduce((a, l) => a + l.qty * l.cost, 0);
  const grand = Math.max(0, subtotal + (Number(freight) || 0) * 100 - (Number(discount) || 0) * 100);
  const paidAmt = status === "PAID" ? grand : status === "PARTIAL" ? Math.min(grand, (Number(paid) || 0) * 100) : 0;
  const due = Math.max(0, grand - paidAmt);

  async function save() {
    setError("");
    if (lines.length === 0) return setError("Add at least one item");
    if (due > 0 && !supplier.trim()) return setError("Unpaid / partial purchase needs a supplier");
    setSaving(true);

    // 1) Create any staged NEW products (as drafts) now, mapping temp ids → real ids.
    const idMap: Record<string, string> = {};
    const tempIds = [...new Set(lines.filter((l) => l.productId.startsWith("new-")).map((l) => l.productId))];
    for (const tid of tempIds) {
      const dto = allProducts.find((p) => p.id === tid);
      if (!dto) continue;
      const r = await quickCreateProduct({
        name: dto.name, sku: dto.sku, categoryName: dto.categoryName,
        variants: dto.variants.length ? dto.variants.map((v) => ({ label: v.label })) : undefined,
      });
      if (!r.ok) { setSaving(false); return setError(`${dto.name}: ${r.error}`); }
      idMap[tid] = r.product.id;
    }

    // 2) Save the purchase with the real product ids.
    const r = await createPurchase({
      supplierName: supplier, supplierInvoiceNo: invoiceNo,
      invoiceDateYmd: invoiceDate, dateYmd: receivedDate,
      otherChargesRupees: Number(freight) || 0, discountRupees: Number(discount) || 0,
      paymentStatus: status, amountPaidRupees: Number(paid) || 0, paymentMode: mode,
      referenceNo: ref, notes,
      items: lines.map((l) => ({ productId: idMap[l.productId] ?? l.productId, qty: l.qty, costRupees: l.cost / 100, variantLabel: l.variantLabel || undefined })),
    });
    setSaving(false);
    if (!r.ok) return setError(r.error);
    toast.success("Purchase saved — stock updated");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-soft" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900"><Truck className="h-5 w-5 text-brand-600" /> New purchase</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5">
          {/* Supplier & invoice */}
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Supplier & invoice</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <TextField label="Supplier" list="sup-list" value={supplier} onChange={(e) => setSupplier(e.target.value)} hint="Pick or type a new one" />
              <datalist id="sup-list">{supplierNames.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
            <TextField label="Supplier invoice no." value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            <div>
              <label className="mb-1.5 block pl-1 text-xs font-medium text-gray-500">Invoice date</label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
            </div>
            <div>
              <label className="mb-1.5 block pl-1 text-xs font-medium text-gray-500">Received date</label>
              <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
            </div>
          </div>

          {/* Item picker */}
          <p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-gray-400">Items received</p>
          <div className="rounded-2xl border border-gray-200 p-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPicked(null); }} placeholder="Search product by name, brand or SKU…"
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
              {!picked && matches.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-soft">
                  {matches.map((p) => (
                    <button key={p.id} onClick={() => pick(p)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50">
                      <Package size={14} className="text-gray-400" />
                      <span className="flex-1"><b>{p.name}</b>{p.brandName && <span className="text-gray-400"> · {p.brandName}</span>}</span>
                      <span className="font-mono text-xs text-gray-400">{p.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* No match → add a new product right here (as a draft) */}
            {!picked && !quickOpen && search.trim() && matches.length === 0 && (
              <button onClick={openQuickAdd} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-brand-50 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-100">
                <Plus size={15} /> Add &ldquo;{search.trim()}&rdquo; as a new product
              </button>
            )}

            {quickOpen && (
              <div className="mt-2 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-700">New product (draft)</p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <TextField label="Product name" value={qName} onChange={(e) => setQName(e.target.value)} />
                  <TextField label="SKU / item code" value={qSku} onChange={(e) => setQSku(e.target.value)} />
                  <TextField label="Category (optional)" value={qCat} onChange={(e) => setQCat(e.target.value)} />
                  <TextField label="Sizes (optional)" value={qSizes}
                    onChange={(e) => { setQSizes(e.target.value); setQBuySize(""); }} hint="Comma separated, e.g. S, M, L" />
                </div>

                <p className="mb-1.5 mt-3 text-xs font-bold uppercase tracking-wider text-brand-700">Buying now (goes into stock)</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {qSizeList.length > 0 && (
                    <Select label="Which size" value={qBuySize} onChange={(e) => setQBuySize(e.target.value)}>
                      <option value="">Select…</option>
                      {qSizeList.map((s) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  )}
                  <TextField label="Qty received" inputMode="numeric" value={qQty} onChange={(e) => setQQty(e.target.value)} />
                  <TextField label="Unit cost ₹" inputMode="numeric" value={qCost} onChange={(e) => setQCost(e.target.value)} />
                </div>
                {qSizeList.length > 1 && (
                  <p className="mt-1.5 text-[11px] text-gray-400">Other sizes? Save this one, then search the product again to add more size lines.</p>
                )}

                <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-gray-500">
                  Added as a <b className="text-amber-600">draft (not for sale)</b>. An owner/manager sets the selling price later via <b>Products → Ready to sell</b> — until then cashiers can&rsquo;t sell it.
                </p>
                {qErr && <p className="mt-2 text-sm text-red-600">{qErr}</p>}
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="outlined" onClick={() => setQuickOpen(false)} disabled={qSaving} className="px-3 py-1.5 text-xs">Cancel</Button>
                  <Button onClick={saveQuickProduct} loading={qSaving} className="px-3 py-1.5 text-xs">{qSaving ? "Adding…" : "Add to purchase"}</Button>
                </div>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {picked && picked.variants.length > 0 && (
                <Select label="Variant" value={variant} onChange={(e) => setVariant(e.target.value)}>
                  {picked.variants.map((v) => <option key={v.label} value={v.label}>{v.label} (stock {v.stock})</option>)}
                </Select>
              )}
              <TextField label="Qty received" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
              <TextField label="Unit cost ₹" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} />
              <div className="flex items-end">
                <Button variant="tonal" onClick={addLine} fullWidth><Plus className="h-4 w-4" /> Add</Button>
              </div>
            </div>
          </div>

          {/* Lines */}
          {lines.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr><th className="px-3 py-2">Item</th><th className="px-2 text-right">Qty</th><th className="px-2 text-right">Cost</th><th className="px-2 text-right">Total</th><th className="px-2"></th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">
                        <span className="font-medium text-gray-800">{l.name}{l.variantLabel && <span className="text-gray-500"> · {l.variantLabel}</span>}</span>
                        {l.brand && <span className="text-xs text-gray-400"> · {l.brand}</span>}
                      </td>
                      <td className="px-2 text-right">{l.qty}</td>
                      <td className="px-2 text-right">{rs(l.cost)}</td>
                      <td className="px-2 text-right font-medium">{rs(l.qty * l.cost)}</td>
                      <td className="px-2 text-right"><button onClick={() => removeLine(i)} className="rounded-full p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"><Trash2 size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Charges & payment */}
          <p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-gray-400">Charges & payment</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Freight / other charges ₹" inputMode="numeric" value={freight} onChange={(e) => setFreight(e.target.value)} />
            <TextField label="Discount ₹" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
          <div className="mt-3">
            <p className="mb-1.5 text-sm font-medium text-gray-700">Payment status</p>
            <div className="grid grid-cols-3 gap-2">
              {(["PAID", "PARTIAL", "UNPAID"] as const).map((s) => (
                <button key={s} onClick={() => setStatus(s)} className={`rounded-lg border px-2 py-2 text-xs font-semibold capitalize transition ${status === s ? "border-transparent bg-brand-600 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{s.toLowerCase()}</button>
              ))}
            </div>
          </div>
          {status !== "UNPAID" && (
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {status === "PARTIAL" && <TextField label="Amount paid ₹" inputMode="numeric" value={paid} onChange={(e) => setPaid(e.target.value)} />}
              <Select label="Paid by" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
                <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK">Bank</option><option value="CHEQUE">Cheque</option>
              </Select>
              <TextField label="Reference no. (optional)" value={ref} onChange={(e) => setRef(e.target.value)} />
            </div>
          )}
          <div className="mt-3"><TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

          {/* Totals */}
          <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm">
            <Row label="Subtotal" value={rs(subtotal)} />
            {(Number(freight) || 0) > 0 && <Row label="Freight" value={`+ ${rs((Number(freight) || 0) * 100)}`} />}
            {(Number(discount) || 0) > 0 && <Row label="Discount" value={`− ${rs((Number(discount) || 0) * 100)}`} />}
            <div className="my-2 h-px bg-gray-200" />
            <Row label="Grand total" value={rs(grand)} bold />
            <Row label="Paid now" value={rs(paidAmt)} />
            <Row label="Balance due to supplier" value={rs(due)} className={due > 0 ? "text-red-600" : "text-emerald-600"} />
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <span className="flex items-center gap-1.5 text-xs text-gray-400"><Boxes className="h-4 w-4" /> Saving adds stock to each item's variant.</span>
          <div className="flex gap-3">
            <Button variant="outlined" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={save} loading={saving}><Check className="h-4 w-4" /> {saving ? "Saving…" : "Save purchase"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, className = "" }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={`text-gray-500 ${bold ? "font-semibold text-gray-700" : ""}`}>{label}</span>
      <span className={`${bold ? "text-base font-bold text-gray-900" : "font-medium text-gray-700"} ${className}`}>{value}</span>
    </div>
  );
}

// ───────────────────────── View ─────────────────────────

function ViewModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [p, setP] = useState<PurchaseDetail | null | "loading">("loading");
  useEffect(() => { getPurchase(id).then((d) => setP(d)); }, [id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-soft" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-lg font-bold text-gray-900">Purchase details</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-6 text-sm">
          {p === "loading" ? <p className="text-gray-400">Loading…</p> : !p ? <p className="text-gray-400">Not found.</p> : (
            <div className="flex flex-col gap-4">
              {/* header */}
              <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-brand-50 to-white p-4">
                <div>
                  <p className="text-lg font-bold text-gray-900">{p.supplierName || "Walk-in supplier"}</p>
                  <p className="text-xs text-gray-500">
                    {p.supplierInvoiceNo ? `Invoice ${p.supplierInvoiceNo} · ` : ""}Received {new Date(p.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[p.paymentStatus]}`}>
                  {p.paymentStatus === "PARTIAL" ? "Partial" : p.paymentStatus === "UNPAID" ? "Unpaid" : "Paid"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Info label="Invoice date" value={p.invoiceDate ? new Date(p.invoiceDate).toLocaleDateString("en-IN") : "—"} />
                <Info label="Paid by" value={p.paymentStatus === "UNPAID" ? "—" : p.paymentMode} />
                <Info label="Reference" value={p.referenceNo || "—"} />
              </div>

              {/* items */}
              <div className="overflow-hidden rounded-2xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500"><tr><th className="px-3 py-2.5">Item</th><th className="px-2 py-2.5 text-right">Qty</th><th className="px-2 py-2.5 text-right">Cost</th><th className="px-2 py-2.5 text-right">Total</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {p.items.map((it, i) => (
                      <tr key={i}><td className="px-3 py-2"><span className="font-medium text-gray-800">{it.name}</span>{it.sku && <span className="ml-1.5 font-mono text-[11px] text-gray-400">{it.sku}</span>}</td><td className="px-2 py-2 text-right text-gray-600">{it.qty}</td><td className="px-2 py-2 text-right text-gray-600">{rs(it.cost)}</td><td className="px-2 py-2 text-right font-semibold text-gray-900">{rs(it.lineTotal)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* totals */}
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <Row label="Subtotal" value={rs(p.subtotal)} />
                {p.otherCharges > 0 && <Row label="Freight / other" value={`+ ${rs(p.otherCharges)}`} />}
                {p.discountAmount > 0 && <Row label="Discount" value={`− ${rs(p.discountAmount)}`} />}
                <div className="my-2 h-px bg-gray-200" />
                <Row label="Grand total" value={rs(p.totalCost)} bold />
                <Row label="Paid" value={rs(p.amountPaid)} />
                <Row label="Balance due" value={rs(p.dueAmount)} className={p.dueAmount > 0 ? "text-red-600" : "text-emerald-600"} />
              </div>
              {p.notes && <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">Note: {p.notes}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-gray-200 px-3 py-2"><p className="text-xs font-medium text-gray-400">{label}</p><p className="truncate text-sm font-semibold text-gray-800">{value}</p></div>;
}
