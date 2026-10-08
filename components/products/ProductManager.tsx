"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Package, Search, Check, EyeOff, Barcode } from "lucide-react";
import { createProduct, updateProduct, adjustStock, adjustVariantStock, setSellable, markReady, type ProductDTO } from "@/actions/products";
import { formatINR, toRupees } from "@/lib/money";
import { UNITS, GST_RATES } from "@/lib/units";
import { Field, InfoTip } from "@/components/InfoTip";
import { BarcodeModal } from "@/components/products/BarcodeModal";

type Mode = { kind: "closed" } | { kind: "add" } | { kind: "edit"; product: ProductDTO };

/** Price shown in the list: "—" for a priceless draft, a range for mixed-price sizes, else one price. */
function priceLabel(p: ProductDTO): React.ReactNode {
  if (!p.sellable && p.salePrice === 0) return <span className="text-gray-300">—</span>;
  // Each size can have its own price — show a range when they differ.
  if (p.variants.length > 0) {
    const prices = p.variants.map((v) => v.price ?? p.salePrice);
    const lo = Math.min(...prices), hi = Math.max(...prices);
    return lo === hi ? formatINR(lo) : `${formatINR(lo)}–${formatINR(hi)}`;
  }
  return formatINR(p.salePrice);
}

/** Sizes at/below their own alert level. For simple products returns []. */
function lowSizes(p: ProductDTO) {
  return p.variants.filter((v) => v.stock <= v.minStock);
}
/** Is the product low on stock? Per-size for variants, overall for simple products. */
function isLow(p: ProductDTO) {
  return p.variants.length > 0 ? lowSizes(p).length > 0 : p.currentStock <= p.minStock;
}

export function ProductManager({ initial, categories, shopName, canEdit = true }: { initial: ProductDTO[]; categories: string[]; shopName: string; canEdit?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "closed" });
  const [stockFor, setStockFor] = useState<ProductDTO | null>(null);
  const [readyFor, setReadyFor] = useState<ProductDTO | null>(null);
  const [barcodeFor, setBarcodeFor] = useState<ProductDTO | null>(null);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("");

  const filtered = initial.filter((p) => {
    const q = query.trim().toLowerCase();
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    const matchCat = !cat || p.categoryName === cat;
    return matchQ && matchCat;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        {categories.length > 0 && (
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {canEdit && (
          <button
            onClick={() => setMode({ kind: "add" })}
            className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            <Plus size={16} /> Add product
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-center">GST</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  {initial.length === 0 ? "No products yet. Add your first product to start billing." : "No matches."}
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const low = isLow(p);
              const lows = lowSizes(p);
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">{p.name}</div>
                    {(p.variants.length > 0 || !p.sellable) && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {p.variants.length > 0 && (
                          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                            {p.variants.length} {p.variants.length === 1 ? "size" : "sizes"}
                          </span>
                        )}
                        {!p.sellable && (
                          <span className="whitespace-nowrap rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            Draft · not for sale
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-gray-500">{p.sku}</td>
                  <td className="px-4 py-3 align-top text-gray-500">{p.categoryName || "—"}</td>
                  <td className="px-4 py-3 align-top text-right">{priceLabel(p)}</td>
                  <td className="px-4 py-3 align-top text-center">{p.taxRate}%</td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${low ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                        {p.currentStock} {p.unit}
                      </span>
                      {low && p.variants.length === 0 && (
                        <span className="text-[10px] text-red-500">
                          Low{p.minStock > 0 ? ` · alert at ${p.minStock}` : ""}
                        </span>
                      )}
                      {lows.length > 0 && (
                        <div className="flex max-w-[260px] flex-wrap justify-end gap-1">
                          <span className="text-[10px] font-medium text-red-500">Low:</span>
                          {lows.map((v) => (
                            <span key={v.label} className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-red-600" title={`Size ${v.label}: ${v.stock} left — alert set at ${v.minStock}`}>
                              {v.label} ({v.stock})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex justify-end gap-2">
                      {canEdit && (p.sellable ? (
                        <button onClick={async () => { await setSellable({ id: p.id, sellable: false }); router.refresh(); }}
                          className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100" title="Stop selling (make draft)">
                          <EyeOff size={13} /> Draft
                        </button>
                      ) : (
                        <button onClick={() => setReadyFor(p)}
                          className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700" title="Set selling price and make ready to sell">
                          <Check size={13} /> Ready to sell
                        </button>
                      ))}
                      {canEdit && (
                        <button onClick={() => setStockFor(p)} className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-gray-100">
                          <Package size={13} /> Stock
                        </button>
                      )}
                      <button onClick={() => setBarcodeFor(p)} className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-gray-100" title="View, download or print barcodes">
                        <Barcode size={13} /> Barcode
                      </button>
                      {canEdit ? (
                        <button onClick={() => setMode({ kind: "edit", product: p })} className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-gray-100">
                          <Pencil size={13} /> Edit
                        </button>
                      ) : (
                        <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-400">View only</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mode.kind !== "closed" && (
        <ProductForm
          product={mode.kind === "edit" ? mode.product : null}
          categories={categories}
          onClose={() => setMode({ kind: "closed" })}
          onSaved={() => { setMode({ kind: "closed" }); router.refresh(); }}
        />
      )}
      {stockFor && (
        <StockModal
          product={stockFor}
          onClose={() => setStockFor(null)}
          onSaved={() => { setStockFor(null); router.refresh(); }}
        />
      )}
      {readyFor && (
        <ReadyModal
          product={readyFor}
          onClose={() => setReadyFor(null)}
          onSaved={() => { setReadyFor(null); router.refresh(); }}
        />
      )}
      {barcodeFor && (
        <BarcodeModal
          productId={barcodeFor.id}
          shopName={shopName}
          onClose={() => { setBarcodeFor(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-7 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-5 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}


const inputCls = "rounded-lg border border-gray-300 px-3 py-2 text-sm";

interface VariantRow { label: string; barcode: string; openingStock: number; minStock: number; priceRupees: string; existingStock: number | null }

function ProductForm({ product, categories, onClose, onSaved }: { product: ProductDTO | null; categories: string[]; onClose: () => void; onSaved: () => void }) {
  const editing = !!product;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasVariants, setHasVariants] = useState((product?.variants.length ?? 0) > 0);
  const [variants, setVariants] = useState<VariantRow[]>(
    (product?.variants ?? []).map((v) => ({
      label: v.label, barcode: v.barcode, openingStock: 0, minStock: v.minStock ?? 0, existingStock: v.stock,
      // Pre-fill each size's price: its own price if set, else fall back to the
      // product's current price so existing data isn't lost when editing.
      priceRupees: v.price != null ? String(v.price / 100) : (product && product.salePrice > 0 ? String(product.salePrice / 100) : ""),
    }))
  );

  const addVariant = () => setVariants((vs) => [...vs, { label: "", barcode: "", openingStock: 0, minStock: 0, priceRupees: "", existingStock: null }]);
  const patchVariant = (i: number, p: Partial<VariantRow>) => setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...p } : v)));
  const removeVariant = (i: number) => setVariants((vs) => vs.filter((_, idx) => idx !== i));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const rows = variants.filter((v) => v.label.trim());
    if (hasVariants) {
      const labels = rows.map((v) => v.label.trim());
      if (labels.length === 0) return setError("Add at least one size, or turn off sizes");
      if (new Set(labels).size !== labels.length) return setError("Sizes must be unique");
      for (const v of rows) {
        if (v.priceRupees === "" || Number(v.priceRupees) <= 0) return setError(`Enter a sale price for size ${v.label.trim()}`);
      }
    }
    setSaving(true);
    const f = new FormData(e.currentTarget);
    // With sizes, each size carries its own price; the product-level price is just a
    // fallback, so use the lowest size price to keep the schema happy.
    const salePriceRupees = hasVariants
      ? Math.min(...rows.map((v) => Number(v.priceRupees)))
      : f.get("salePriceRupees");
    const common = {
      name: f.get("name"),
      sku: f.get("sku"),
      barcode: f.get("barcode") || "",
      hsn: f.get("hsn") || "",
      unit: f.get("unit") || "pcs",
      salePriceRupees,
      taxRate: f.get("taxRate"),
      minStock: f.get("minStock") || 0,
      discountValue: f.get("discountValue") || 0,
      discountUnit: f.get("discountUnit") || "₹",
      categoryName: f.get("categoryName") || "",
      variants: hasVariants
        ? rows.map((v) => ({
            label: v.label.trim(),
            barcode: v.barcode.trim(), // each size's own barcode (for scanning)
            openingStock: v.openingStock || 0,
            minStock: v.minStock || 0,
            priceRupees: Number(v.priceRupees), // each size has its own sale price
          }))
        : undefined,
    };
    const res = editing
      ? await updateProduct({ ...common, id: product!.id })
      : await createProduct({ ...common, openingStock: hasVariants ? 0 : f.get("openingStock") || 0 });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onSaved();
  }

  return (
    <Modal title={editing ? "Edit product" : "Add product"} onClose={onClose}>
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-x-5 gap-y-5">
        <div className="col-span-2">
          <Field label="Product name" hint="The name shown on bills and when you search in billing.">
            <input name="name" required defaultValue={product?.name} placeholder="e.g. Cotton T-Shirt" className={inputCls} />
          </Field>
        </div>
        <Field label="SKU / code" hint="A short unique code to identify this product (e.g. TS001). No two products can share the same code.">
          <input name="sku" required defaultValue={product?.sku} placeholder="TS001" className={inputCls} />
        </Field>
        <Field label="Barcode (optional)" hint="For products WITHOUT sizes: the barcode on the product. Scan it (phone or USB) at billing to add the item instantly. For products with sizes, set each size's barcode in the Sizes section below.">
          <input name="barcode" defaultValue={product?.barcode ?? ""} placeholder="Scan or type" className={inputCls} />
        </Field>
        {hasVariants ? (
          // With sizes, price is set per size below — no single product price here.
          <Field label="Sale price (₹)" hint="This product has sizes, so each size has its own price in the Sizes section below.">
            <div className={`${inputCls} flex items-center text-gray-400`}>Set per size below ↓</div>
          </Field>
        ) : (
          <Field label="Sale price (₹)" hint="The price you sell at, per unit, in rupees. You can still change it on each bill.">
            <input name="salePriceRupees" type="number" step="0.01" required
              defaultValue={product ? toRupees(product.salePrice) : ""} placeholder="525.00" className={inputCls} />
          </Field>
        )}
        <Field label="GST rate" hint="The GST % charged on this item. Printed on the tax invoice. Choose 0% if GST does not apply.">
          <select name="taxRate" defaultValue={product?.taxRate ?? 0} className={inputCls}>
            {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
          </select>
        </Field>
        <Field label="Unit" hint="How you sell this item — pieces (pcs), kilograms (kg), litre, box, etc.">
          <select name="unit" defaultValue={product?.unit ?? "pcs"} className={inputCls}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="HSN code (optional)" hint="A GST classification code for the product. Registered businesses must print it on tax invoices. Ask your supplier or CA if you are unsure.">
          <input name="hsn" defaultValue={product?.hsn ?? ""} placeholder="6109" className={inputCls} />
        </Field>
        <Field label="Category (optional)" hint="Group products (e.g. Shirts, Groceries). Type a new one or pick an existing — used to filter the product list.">
          <input name="categoryName" list="category-list" defaultValue={product?.categoryName ?? ""} placeholder="e.g. Shirts" className={inputCls} />
          <datalist id="category-list">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>
        {!editing && !hasVariants && (
          <Field label="Opening stock" hint="How many you have in hand right now. You can adjust it anytime from the Stock button.">
            <input name="openingStock" type="number" min={0} defaultValue={0} className={inputCls} />
          </Field>
        )}
        {hasVariants ? (
          // With sizes, each size has its own alert below — keep the product-level
          // value untouched (don't overwrite existing data) via a hidden field.
          <input type="hidden" name="minStock" value={product?.minStock ?? 0} />
        ) : (
          <Field label="Low-stock alert at" hint="You'll see a low-stock warning when the quantity falls to this number. Set 0 for no alert.">
            <input name="minStock" type="number" min={0} defaultValue={product?.minStock ?? 0} className={inputCls} />
          </Field>
        )}

        {/* Sizes / variants */}
        <div className="col-span-2 rounded-xl border border-gray-200 bg-gray-50/50 p-5">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" checked={hasVariants} onChange={(e) => { setHasVariants(e.target.checked); if (e.target.checked && variants.length === 0) addVariant(); }} />
            This product has sizes / variants (S, M, L or 32, 36…)
            <InfoTip text="Turn on for clothing/footwear. Each size gets its own barcode, sale price, stock and low-stock alert. The top Barcode field is only used for products without sizes." />
          </label>

          {hasVariants && (
            <div className="mt-4 flex flex-col gap-3">
              <p className="rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                Each size has its own <b>barcode</b> (from its tag — for phone/USB scanning), <b>sale price</b>, stock and low-stock alert.
              </p>
              <div className="grid grid-cols-[3rem_1fr_5rem_5.5rem_4.5rem_1.5rem] items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                <span>Size</span>
                <span>Barcode (scan / type)</span>
                <span>{editing ? "In stock" : "Opening"}</span>
                <span>Sale price ₹</span>
                <span>Alert at</span>
                <span />
              </div>
              {variants.map((v, i) => (
                <div key={i} className="grid grid-cols-[3rem_1fr_5rem_5.5rem_4.5rem_1.5rem] items-center gap-2">
                  <input value={v.label} onChange={(e) => patchVariant(i, { label: e.target.value })} placeholder="M" className={`${inputCls} w-full`} />
                  <input value={v.barcode} onChange={(e) => patchVariant(i, { barcode: e.target.value })} title="This size's barcode — scan the tag or type it, or generate one from the Barcodes button" placeholder="scan / type" className={`${inputCls} w-full`} />
                  {v.existingStock != null ? (
                    <span className="text-sm text-gray-600" title="Change stock from the Stock button on the product list">{v.existingStock}</span>
                  ) : (
                    <input type="number" min={0} value={v.openingStock} onChange={(e) => patchVariant(i, { openingStock: Math.max(0, Number(e.target.value)) })} className={`${inputCls} w-full`} />
                  )}
                  <input type="number" min={0} step="0.01" value={v.priceRupees} onChange={(e) => patchVariant(i, { priceRupees: e.target.value })} title="Sale price for this size" placeholder="599" className={`${inputCls} w-full`} />
                  <input type="number" min={0} value={v.minStock} onChange={(e) => patchVariant(i, { minStock: Math.max(0, Number(e.target.value)) })} title="Low-stock alert for this size" placeholder="0" className={`${inputCls} w-full`} />
                  <button type="button" onClick={() => removeVariant(i)} className="flex justify-center text-red-400 hover:text-red-600" title="Remove size">✕</button>
                </div>
              ))}
              <button type="button" onClick={addVariant} className="mt-1 flex items-center gap-1 self-start rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-100">
                <Plus size={13} /> Add size
              </button>
            </div>
          )}
        </div>

        <div className="col-span-2">
          <Field label="Standard discount (optional)" hint="A default discount auto-filled on bills for this product. Choose ₹ for a flat amount per unit, or % for a percentage. Leave 0 for none.">
            <div className="flex gap-2">
              <input name="discountValue" type="number" min={0} step="0.01"
                defaultValue={product ? (product.discountUnit === "₹" ? toRupees(product.discount) : product.discount) : 0}
                className={`${inputCls} flex-1`} />
              <select name="discountUnit" defaultValue={product?.discountUnit ?? "₹"} className={`${inputCls} w-20`}>
                <option value="₹">₹</option>
                <option value="%">%</option>
              </select>
            </div>
          </Field>
        </div>

        {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
        <div className="col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          <button disabled={saving} className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">
            {saving ? "Saving…" : editing ? "Save changes" : "Add product"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StockModal({ product, onClose, onSaved }: { product: ProductDTO; onClose: () => void; onSaved: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const hasVariants = product.variants.length > 0;
  const [counts, setCounts] = useState<Record<string, number>>(
    Object.fromEntries(product.variants.map((v) => [v.label, v.stock]))
  );
  const [single, setSingle] = useState(product.currentStock);

  async function save() {
    setError("");
    setSaving(true);
    let bad: { ok: boolean; error?: string } = { ok: true };
    if (hasVariants) {
      for (const v of product.variants) {
        const r = await adjustVariantStock({ id: product.id, label: v.label, newCount: counts[v.label] });
        if (!r.ok) { bad = r; break; }
      }
    } else {
      bad = await adjustStock({ id: product.id, newCount: single });
    }
    setSaving(false);
    if (!bad.ok) return setError(bad.error ?? "Could not update");
    router.refresh();
    onSaved();
  }

  return (
    <Modal title={`Adjust stock — ${product.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {hasVariants ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-500">Set the stock for each size:</p>
            {product.variants.map((v) => (
              <div key={v.label} className="flex items-center gap-3">
                <span className="w-16 rounded bg-gray-100 px-2 py-1 text-center text-sm font-medium">{v.label}</span>
                <span className="text-xs text-gray-400">now {v.stock}</span>
                <input type="number" min={0} value={counts[v.label]} onChange={(e) => setCounts((c) => ({ ...c, [v.label]: Math.max(0, Number(e.target.value)) }))} className={`${inputCls} ml-auto w-28`} />
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500">Current stock: <b>{product.currentStock} {product.unit}</b></p>
            <Field label="New stock count">
              <input type="number" min={0} value={single} onChange={(e) => setSingle(Math.max(0, Number(e.target.value)))} className={inputCls} autoFocus />
            </Field>
          </>
        )}
        <p className="text-xs text-gray-400">The difference is recorded as a stock adjustment in the ledger.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">
            {saving ? "Saving…" : "Update stock"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ReadyModal({ product, onClose, onSaved }: { product: ProductDTO; onClose: () => void; onSaved: () => void }) {
  const hasVariants = product.variants.length > 0;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Pre-fill with any existing prices so the user can just confirm or change them.
  const [taxRate, setTaxRate] = useState(String(product.taxRate ?? 0));
  const [singlePrice, setSinglePrice] = useState(product.salePrice > 0 ? String(toRupees(product.salePrice)) : "");
  // Per-size prices, pre-filled with each size's price or the product fallback.
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(product.variants.map((v) => [
      v.label,
      v.price != null ? String(toRupees(v.price)) : (product.salePrice > 0 ? String(toRupees(product.salePrice)) : ""),
    ]))
  );
  const hasExisting = hasVariants ? product.variants.some((v) => v.price != null) : product.salePrice > 0;

  async function save() {
    setError("");
    if (hasVariants) {
      for (const v of product.variants) {
        if (!prices[v.label] || Number(prices[v.label]) <= 0) return setError(`Enter a price for size ${v.label}`);
      }
    } else if (!singlePrice || Number(singlePrice) <= 0) {
      return setError("Enter a valid selling price");
    }
    setSaving(true);
    const res = await markReady({
      id: product.id,
      salePriceRupees: hasVariants ? 0 : singlePrice,
      taxRate,
      variantPrices: hasVariants ? product.variants.map((v) => ({ label: v.label, priceRupees: prices[v.label] })) : undefined,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onSaved();
  }

  return (
    <Modal title={`Ready to sell — ${product.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-500">
          {hasExisting
            ? "This already has a price — confirm it, or change it below. It then appears in billing."
            : hasVariants
              ? "Set the selling price for each size. It then appears in billing."
              : "Set the price you'll sell this at. It then appears in billing."}
        </p>

        {hasVariants ? (
          <div className="flex flex-col gap-2">
            {product.variants.map((v) => (
              <div key={v.label} className="flex items-center gap-3">
                <span className="w-16 rounded bg-gray-100 px-2 py-1 text-center text-sm font-medium">{v.label}</span>
                <span className="text-xs text-gray-400">{v.stock} in stock</span>
                <div className="relative ml-auto w-40">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                  <input type="number" step="0.01" min={0} value={prices[v.label] ?? ""}
                    onChange={(e) => setPrices((p) => ({ ...p, [v.label]: e.target.value }))}
                    placeholder="price" className={`${inputCls} w-full pl-7`} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Field label="Selling price (₹)" hint="What the customer pays, per unit. You can still change it on each bill.">
            <input type="number" step="0.01" min={0} value={singlePrice} onChange={(e) => setSinglePrice(e.target.value)} placeholder="e.g. 599" className={`${inputCls} w-full`} autoFocus />
          </Field>
        )}

        <Field label="GST rate" hint="GST % charged on this item. 0% if GST does not apply.">
          <select value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className={`${inputCls} w-48`}>
            {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
          </select>
        </Field>

        <p className="text-xs text-gray-400">Tip: add HSN, category or more sizes anytime via Edit.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? "Saving…" : hasExisting ? "Confirm & make ready" : "Make ready to sell"}</button>
        </div>
      </div>
    </Modal>
  );
}
