"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Search, Download, Eye, Pencil } from "lucide-react";
import { createPurchase, getPurchase, editPurchase, deletePurchase, type PurchaseListRow, type PurchaseDetail } from "@/actions/purchases";
import { quickCreateProduct, type ProductDTO } from "@/actions/products";
import { formatINR, toRupees } from "@/lib/money";
import { downloadCsv, paiseToCsv } from "@/lib/csv";
import { Field } from "@/components/InfoTip";
import { UNITS } from "@/lib/units";

interface Line { product: ProductDTO; variantLabel?: string; qty: number; costRupees: number }
interface PEntry { product: ProductDTO; variantLabel?: string; price: number; stock: number }
interface EditData { id: string; supplierName: string; supplierInvoiceNo: string; paymentMethod: "PAID" | "CREDIT"; lines: Line[] }
const pKey = (productId: string, variantLabel?: string) => `${productId}::${variantLabel ?? ""}`;

export function PurchaseManager({ products, purchases, supplierNames, categories }: { products: ProductDTO[]; purchases: PurchaseListRow[]; supplierNames: string[]; categories: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditData | null>(null);

  async function openEdit(id: string) {
    const d = await getPurchase(id);
    if (!d) return alert("Could not load this purchase");
    const lines: Line[] = [];
    for (const it of d.items) {
      const product = products.find((p) => p.id === it.productId);
      if (product) lines.push({ product, variantLabel: it.variantLabel || undefined, qty: it.qty, costRupees: it.cost / 100 });
    }
    setEditData({ id: d.id, supplierName: d.supplierName, supplierInvoiceNo: d.supplierInvoiceNo, paymentMethod: d.paymentMethod === "CREDIT" ? "CREDIT" : "PAID", lines });
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const fromT = from ? new Date(from + "T00:00:00").getTime() : -Infinity;
    const toT = to ? new Date(to + "T23:59:59").getTime() : Infinity;
    return purchases.filter((p) => {
      const t = new Date(p.date).getTime();
      if (t < fromT || t > toT) return false;
      if (!query) return true;
      return p.supplierName.toLowerCase().includes(query) || p.supplierInvoiceNo.toLowerCase().includes(query);
    });
  }, [purchases, q, from, to]);

  const totalCost = filtered.reduce((a, p) => a + p.totalCost, 0);

  function exportCsv() {
    downloadCsv(
      "purchases.csv",
      ["Date", "Supplier", "Invoice #", "Items", "Total Cost (INR)"],
      filtered.map((p) => [
        new Date(p.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }),
        p.supplierName,
        p.supplierInvoiceNo,
        p.itemCount,
        paiseToCsv(p.totalCost),
      ])
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white">
          <Plus size={16} /> New purchase
        </button>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search supplier or invoice…"
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
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Purchases</p>
          <p className="mt-1 text-2xl font-semibold">{filtered.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Total cost</p>
          <p className="mt-1 text-2xl font-semibold">{formatINR(totalCost)}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3 text-center">Items</th>
              <th className="px-4 py-3 text-right">Total cost</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                {purchases.length === 0 ? "No purchases yet. Record one to add stock." : "No purchases match."}
              </td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">
                  {new Date(p.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" })}
                </td>
                <td className="px-4 py-3">{p.supplierName || <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-gray-500">{p.supplierInvoiceNo || "—"}</td>
                <td className="px-4 py-3 text-center">{p.itemCount}</td>
                <td className="px-4 py-3 text-right font-medium">{formatINR(p.totalCost)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => setViewId(p.id)} title="View" className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-100"><Eye size={13} /> View</button>
                    <button onClick={() => openEdit(p.id)} title="Edit" className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-100"><Pencil size={13} /> Edit</button>
                    <PurchaseDeleteButton id={p.id} onDone={() => router.refresh()} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewId && <PurchaseViewModal id={viewId} onClose={() => setViewId(null)} />}

      {(open || editData) && (
        <PurchaseForm
          products={products}
          supplierNames={supplierNames}
          categories={categories}
          edit={editData ?? undefined}
          onClose={() => { setOpen(false); setEditData(null); }}
          onSaved={() => { setOpen(false); setEditData(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

const inputCls = "rounded-lg border border-gray-300 px-3 py-2 text-sm";

function PurchaseForm({ products, supplierNames, categories, edit, onClose, onSaved }: { products: ProductDTO[]; supplierNames: string[]; categories: string[]; edit?: EditData; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!edit;
  const [lines, setLines] = useState<Line[]>(edit?.lines ?? []);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [payMethod, setPayMethod] = useState<"PAID" | "CREDIT">(edit?.paymentMethod ?? "PAID");
  const [showQuick, setShowQuick] = useState(false);
  const [extraProducts, setExtraProducts] = useState<ProductDTO[]>([]); // quick-created this session
  const [picked, setPicked] = useState<PEntry[]>([]); // multi-select in the search dropdown

  // De-duplicate by product id so a product that's in both lists isn't shown twice.
  const allProducts = useMemo(() => {
    const seen = new Set<string>();
    return [...extraProducts, ...products].filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  }, [extraProducts, products]);

  const matches = useMemo<PEntry[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: PEntry[] = [];
    for (const p of allProducts) {
      const hit = p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      if (!hit) continue;
      if (p.variants.length > 0) p.variants.forEach((v) => out.push({ product: p, variantLabel: v.label, price: v.price ?? p.salePrice, stock: v.stock }));
      else out.push({ product: p, price: p.salePrice, stock: p.currentStock });
      if (out.length >= 50) break;
    }
    return out;
  }, [query, allProducts]);

  function addEntry(e: PEntry) {
    const k = pKey(e.product.id, e.variantLabel);
    setLines((l) => l.some((x) => pKey(x.product.id, x.variantLabel) === k) ? l : [...l, { product: e.product, variantLabel: e.variantLabel, qty: 1, costRupees: toRupees(e.price) }]);
  }
  const isPicked = (e: PEntry) => picked.some((x) => pKey(x.product.id, x.variantLabel) === pKey(e.product.id, e.variantLabel));
  function togglePick(e: PEntry) {
    const k = pKey(e.product.id, e.variantLabel);
    setPicked((p) => (p.some((x) => pKey(x.product.id, x.variantLabel) === k) ? p.filter((x) => pKey(x.product.id, x.variantLabel) !== k) : [...p, e]));
  }
  function addPicked() {
    picked.forEach(addEntry);
    setPicked([]);
    setQuery("");
  }
  function patch(k: string, p: Partial<Line>) { setLines((l) => l.map((x) => pKey(x.product.id, x.variantLabel) === k ? { ...x, ...p } : x)); }
  function remove(k: string) { setLines((l) => l.filter((x) => pKey(x.product.id, x.variantLabel) !== k)); }

  const total = lines.reduce((a, l) => a + l.qty * l.costRupees, 0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lines.length === 0) return setError("Add at least one item");
    setError("");
    setSaving(true);
    const f = new FormData(e.currentTarget);
    const payload = {
      supplierName: f.get("supplierName") || "",
      supplierInvoiceNo: f.get("supplierInvoiceNo") || "",
      paymentMethod: payMethod,
      items: lines.map((l) => ({ productId: l.product.id, qty: l.qty, costRupees: l.costRupees, variantLabel: l.variantLabel })),
    };
    const res = isEdit ? await editPurchase({ ...payload, id: edit!.id }) : await createPurchase(payload);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">{isEdit ? "Edit purchase" : "New purchase"}</h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Supplier (optional)" hint="Who you bought from. They're saved to your Suppliers list. For credit purchases, the amount is added to their dues.">
              <input name="supplierName" list="supplier-list" defaultValue={edit?.supplierName ?? ""} placeholder="Type or pick a supplier" className={`${inputCls} w-full`} />
              <datalist id="supplier-list">
                {supplierNames.map((s) => <option key={s} value={s} />)}
              </datalist>
            </Field>
            <Field label="Supplier invoice # (optional)" hint="The bill number on the supplier's invoice, for your records.">
              <input name="supplierInvoiceNo" defaultValue={edit?.supplierInvoiceNo ?? ""} placeholder="e.g. 4521" className={`${inputCls} w-full`} />
            </Field>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product to add…" className={`${inputCls} w-full pl-9`} />
            </div>
            <button type="button" onClick={() => setShowQuick(true)} className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <Plus size={15} /> New product
            </button>
          </div>

          {picked.length > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-indigo-50 px-3 py-2 text-sm">
              <span className="font-medium text-indigo-700">{picked.length} product{picked.length > 1 ? "s" : ""} selected</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPicked([])} className="rounded border border-indigo-200 px-3 py-1 text-indigo-700">Clear</button>
                <button type="button" onClick={addPicked} className="rounded bg-black px-3 py-1 font-medium text-white">Add selected</button>
              </div>
            </div>
          )}

          <div className="relative">
            {matches.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-white shadow">
                {matches.map((e) => {
                  const checked = isPicked(e);
                  return (
                    <label key={pKey(e.product.id, e.variantLabel)} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100">
                      <input type="checkbox" checked={checked} onChange={() => togglePick(e)} />
                      <span className="flex-1">{e.product.name}{e.variantLabel && <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium">{e.variantLabel}</span>} <span className="text-gray-400">({e.product.sku})</span></span>
                      <span className="text-gray-400">stock {e.stock}</span>
                    </label>
                  );
                })}
                {picked.length > 0 && (
                  <div className="sticky bottom-0 border-t bg-white p-2">
                    <button type="button" onClick={addPicked} className="w-full rounded-xl bg-gray-900 py-2 text-sm font-medium text-white">
                      Add {picked.length} selected
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">Item</th><th>Qty</th><th>Cost ₹/unit</th><th className="text-right">Line total</th><th></th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400">No items added.</td></tr>}
              {lines.map((l) => {
                const k = pKey(l.product.id, l.variantLabel);
                return (
                <tr key={k} className="border-b">
                  <td className="py-2">
                    <span className="font-medium">{l.product.name}</span>
                    {l.variantLabel && <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">{l.variantLabel}</span>}
                    <span className="ml-1.5 text-xs text-gray-400">{l.product.sku}</span>
                  </td>
                  <td><input type="number" min={1} value={l.qty} onChange={(e) => patch(k, { qty: Math.max(1, Number(e.target.value)) })} className="w-16 rounded border px-2 py-1" /></td>
                  <td><input type="number" min={0} step="0.01" value={l.costRupees} onChange={(e) => patch(k, { costRupees: Math.max(0, Number(e.target.value)) })} className="w-24 rounded border px-2 py-1" /></td>
                  <td className="text-right">{formatINR(Math.round(l.qty * l.costRupees * 100))}</td>
                  <td className="text-right"><button type="button" onClick={() => remove(k)} className="text-red-500"><Trash2 size={15} /></button></td>
                </tr>
              );})}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm font-medium text-gray-600">Payment</span>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
              {(["PAID", "CREDIT"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setPayMethod(m)}
                  className={`rounded-md px-4 py-1 text-xs font-medium ${payMethod === m ? "bg-white shadow" : "text-gray-500"}`}>
                  {m === "PAID" ? "Paid" : "Credit (due)"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Total cost</span><span>{formatINR(Math.round(total * 100))}</span>
          </div>
          {payMethod === "CREDIT" && <p className="text-xs text-amber-600">Supplier name is required — this amount will be added to their dues.</p>}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
            <button disabled={saving} className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">
              {saving ? "Saving…" : "Save purchase"}
            </button>
          </div>
        </form>
      </div>

      {showQuick && (
        <QuickProductModal
          categories={categories}
          onClose={() => setShowQuick(false)}
          onCreated={(created) => {
            setExtraProducts((xs) => [...created, ...xs]);
            setShowQuick(false);
            // Auto-add the simple (no-size) products as purchase lines right away.
            created.forEach((p) => { if (p.variants.length === 0) addEntry({ product: p, price: p.salePrice, stock: 0 }); });
            // If exactly one product has sizes, show it so the buyer picks the size(s).
            const sized = created.filter((p) => p.variants.length > 0);
            if (sized.length === 1 && created.length === 1) setQuery(sized[0].name);
          }}
        />
      )}
    </div>
  );
}

interface QRow { name: string; sku: string; unit: string; category: string; sizes: string }

function QuickProductModal({ categories, onClose, onCreated }: { categories: string[]; onClose: () => void; onCreated: (products: ProductDTO[]) => void }) {
  const [rows, setRows] = useState<QRow[]>([{ name: "", sku: "", unit: "pcs", category: "", sizes: "" }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const patchRow = (i: number, p: Partial<QRow>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  const addRow = () => setRows((rs) => [...rs, { name: "", sku: "", unit: "pcs", category: "", sizes: "" }]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const filled = rows.filter((r) => r.name.trim() && r.sku.trim());

  async function create() {
    if (filled.length === 0) return setError("Enter at least one product (name and item code)");
    const skus = filled.map((r) => r.sku.trim().toLowerCase());
    if (new Set(skus).size !== skus.length) return setError("Item codes (SKU) must be different for each product");
    setError(""); setSaving(true);
    const created: ProductDTO[] = [];
    for (const r of filled) {
      const variants = r.sizes.split(",").map((s) => s.trim()).filter(Boolean).map((label) => ({ label }));
      const res = await quickCreateProduct({ name: r.name.trim(), sku: r.sku.trim(), unit: r.unit || "pcs", categoryName: r.category.trim(), variants });
      if (!res.ok) { setSaving(false); return setError(`"${r.name.trim()}" — ${res.error}`); }
      created.push(res.product);
    }
    setSaving(false);
    onCreated(created);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Add new products</h3>
        <p className="mb-4 text-sm text-gray-500">
          Add one or more products to buy. Enter the <b>buy cost</b> in the purchase below; set the
          <b> selling price</b> later with “Ready to sell” in Products. Saved as drafts.
        </p>

        <div className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Product {i + 1}</span>
                {rows.length > 1 && <button type="button" onClick={() => removeRow(i)} className="text-xs text-red-500 hover:underline">Remove</button>}
              </div>
              <input value={r.name} onChange={(e) => patchRow(i, { name: e.target.value })} placeholder="Product name (e.g. Cotton T-Shirt)" className={`${inputCls} w-full`} />
              <div className="grid grid-cols-2 gap-2">
                <input value={r.sku} onChange={(e) => patchRow(i, { sku: e.target.value })} placeholder="Item code / SKU (e.g. TS001)" className={inputCls} />
                <select value={r.unit} onChange={(e) => patchRow(i, { unit: e.target.value })} className={inputCls}>
                  {UNITS.map((u) => <option key={u} value={u}>Sold by: {u}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={r.category} onChange={(e) => patchRow(i, { category: e.target.value })} list="purchase-category-list" placeholder="Category (optional)" className={inputCls} />
                <input value={r.sizes} onChange={(e) => patchRow(i, { sizes: e.target.value })} placeholder="Sizes: S, M, L (optional)" className={inputCls} />
              </div>
            </div>
          ))}
          <datalist id="purchase-category-list">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>

          <button type="button" onClick={addRow} className="flex items-center gap-1.5 self-start rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            <Plus size={15} /> Add another product
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
            <button type="button" onClick={create} disabled={saving || filled.length === 0} className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">
              {saving ? "Creating…" : `Create ${filled.length || ""} product${filled.length === 1 ? "" : "s"}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PurchaseDeleteButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} title="Delete" className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-red-600 hover:bg-red-50">
        <Trash2 size={13} /> Delete
      </button>
      {open && <PurchaseDeleteModal id={id} onClose={() => setOpen(false)} onDone={() => { setOpen(false); onDone(); }} />}
    </>
  );
}

/** Deleting modal — loads the purchase and shows exactly which products/sizes/codes & stock it will reverse. */
function PurchaseDeleteModal({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const [data, setData] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getPurchase(id).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  async function confirmDelete() {
    setBusy(true); setError("");
    const res = await deletePurchase(id);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-lg font-semibold">Delete this purchase?</h2>
        <p className="mb-4 text-sm text-gray-500">This removes the stock this purchase added{data?.paymentMethod === "CREDIT" ? " and reduces the supplier's dues" : ""}. The products themselves are not deleted.</p>

        {loading && <p className="py-6 text-center text-gray-400">Loading…</p>}
        {data && (
          <>
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-medium">{data.supplierName || "No supplier"}{data.supplierInvoiceNo ? ` · Inv ${data.supplierInvoiceNo}` : ""}</span>
              <span className="font-semibold">{formatINR(data.totalCost)}</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2">Code</th><th className="px-3 py-2 text-right">Qty (stock −)</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items.map((i, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-medium">{i.name}</td>
                      <td className="px-3 py-2 text-gray-400">{i.sku || "—"}</td>
                      <td className="px-3 py-2 text-right font-medium text-red-600 tabular-nums">− {i.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              The quantities above will be removed from each product&apos;s stock. If any were already sold, deleting may be blocked.
            </p>
          </>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          <button onClick={confirmDelete} disabled={busy || loading} className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Trash2 size={15} /> {busy ? "Deleting…" : "Delete purchase"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PurchaseViewModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<PurchaseDetail | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    getPurchase(id).then((d) => { if (active) d ? setData(d) : setFailed(true); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [id]);
  const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {failed ? (
          <p className="py-8 text-center text-sm text-red-500">Could not load this purchase.</p>
        ) : !data ? (
          <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{data.supplierName || "Purchase"}</h2>
                <p className="text-sm text-gray-500">Invoice {data.supplierInvoiceNo || "—"} · {fmtDate(data.date)} · {data.paymentMethod === "CREDIT" ? "Credit" : "Paid"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-gray-400">Total</p>
                <p className="text-lg font-semibold">{formatINR(data.totalCost)}</p>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-gray-500"><th className="py-2">Item</th><th className="text-right">Qty</th><th className="text-right">Cost</th><th className="text-right">Line total</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((i, idx) => (
                  <tr key={idx}>
                    <td className="py-2">{i.name}{i.sku && <span className="ml-1.5 text-xs text-gray-400">{i.sku}</span>}</td>
                    <td className="text-right">{i.qty}</td>
                    <td className="text-right">{formatINR(i.cost)}</td>
                    <td className="text-right font-medium">{formatINR(i.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-5 flex justify-end">
              <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
