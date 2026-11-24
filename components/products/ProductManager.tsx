"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Package, Search, Check, Barcode, Trash2 } from "lucide-react";
import { createProduct, updateProduct, adjustStock, setSellable, markReady, deleteProduct, type ProductDTO } from "@/actions/products";
import { AddProductWizard } from "./AddProductWizard";
import { EditProductModal } from "./EditProductModal";
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

export function ProductManager({ initial, categories, brands = [], shopName, canEdit = true }: { initial: ProductDTO[]; categories: string[]; brands?: string[]; shopName: string; canEdit?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "closed" });
  const [showWizard, setShowWizard] = useState(false);
  const [stockFor, setStockFor] = useState<ProductDTO | null>(null);
  const [readyFor, setReadyFor] = useState<ProductDTO | null>(null);
  const [barcodeFor, setBarcodeFor] = useState<ProductDTO | null>(null);
  const [deleteFor, setDeleteFor] = useState<ProductDTO | null>(null);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-full border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {categories.length > 0 && (
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {canEdit && (
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-brand-700 hover:shadow-soft"
          >
            <Plus size={16} /> Add product
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-card">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3.5">Product</th>
              <th className="px-4 py-3.5">SKU</th>
              <th className="px-4 py-3.5">Category</th>
              <th className="px-4 py-3.5 text-center">Dept</th>
              <th className="px-4 py-3.5 text-right">Price</th>
              <th className="px-4 py-3.5 text-center">GST</th>
              <th className="px-4 py-3.5 text-right">Stock</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  {initial.length === 0 ? "No products yet. Add your first product to start billing." : "No matches."}
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const low = isLow(p);
              const lows = lowSizes(p);
              return (
                <tr key={p.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-start gap-3">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-gray-200 object-cover" />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-300">
                          <Package size={18} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900">{p.name}</div>
                        {p.brandName && <div className="text-xs text-gray-400">{p.brandName}</div>}
                        {(p.variants.length > 0 || !p.sellable) && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {p.variants.length > 0 && (
                              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                                {p.variants.length} {p.variants.length === 1 ? "variant" : "variants"}
                              </span>
                            )}
                            {!p.sellable && (
                              <span className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                Draft
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-gray-500">{p.sku}</td>
                  <td className="px-4 py-3 align-top text-gray-500">{p.categoryName || "—"}</td>
                  <td className="px-4 py-3 align-top text-center">
                    {p.department ? (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">{p.department}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    {p.mrp != null && p.mrp > p.salePrice && (
                      <div className="text-[11px] text-gray-400 line-through">₹{Math.round(p.mrp / 100).toLocaleString("en-IN")}</div>
                    )}
                    <div className="font-semibold text-gray-900">{priceLabel(p)}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-center text-gray-500">{p.taxRate}%</td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${low ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                        {p.currentStock} {p.unit}
                      </span>
                      {p.damagedStock > 0 && (
                        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-600" title="Damaged pieces written off — not for sale">
                          {p.damagedStock} damaged
                        </span>
                      )}
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
                    <div className="flex items-center justify-end gap-1.5">
                      {canEdit && (p.sellable ? (
                        <button onClick={async () => { await setSellable({ id: p.id, sellable: false }); router.refresh(); }}
                          className="rounded-full px-3 py-1.5 text-xs font-semibold text-gray-500 transition hover:bg-gray-100" title="Stop selling (make draft)">
                          Draft
                        </button>
                      ) : (
                        <button onClick={() => setReadyFor(p)}
                          className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700" title="Set selling price and make ready to sell">
                          <Check size={13} /> Ready
                        </button>
                      ))}
                      {canEdit && (
                        <IconBtn title="Adjust stock" onClick={() => setStockFor(p)}><Package size={16} /></IconBtn>
                      )}
                      <IconBtn title="Barcodes — view / print labels" onClick={() => setBarcodeFor(p)}><Barcode size={16} /></IconBtn>
                      {canEdit ? (
                        <>
                          <IconBtn title="Edit product" onClick={() => setMode({ kind: "edit", product: p })}><Pencil size={16} /></IconBtn>
                          <IconBtn title="Delete product" danger onClick={() => setDeleteFor(p)}><Trash2 size={16} /></IconBtn>
                        </>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-400">View only</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showWizard && (
        <AddProductWizard
          categories={categories}
          brands={brands}
          onClose={() => setShowWizard(false)}
          onSaved={() => { setShowWizard(false); router.refresh(); }}
        />
      )}

      {mode.kind === "edit" && (
        <EditProductModal
          product={mode.product}
          categories={categories}
          brands={brands}
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
      {deleteFor && (
        <DeleteProductModal
          product={deleteFor}
          onClose={() => setDeleteFor(null)}
          onDone={() => { setDeleteFor(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

/** Compact circular icon action button used in the product list. */
function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition ${danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-brand-50 hover:text-brand-600"}`}>
      {children}
    </button>
  );
}

/** Confirmation that spells out exactly what's being deleted (name, code, sizes, stock). */
function DeleteProductModal({ product, onClose, onDone }: { product: ProductDTO; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirmDelete() {
    setBusy(true); setError("");
    const res = await deleteProduct(product.id);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onDone();
  }
  const hasStock = product.currentStock > 0;
  return (
    <Modal title="Delete product?" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-600">You are about to delete this product. It will be removed from Products and billing. Past bills that used it are kept.</p>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{product.name}</span>
            <span className="text-xs text-gray-400">Code: {product.sku}</span>
          </div>
          {product.barcode && <p className="mt-0.5 text-xs text-gray-500">Barcode: {product.barcode}</p>}
          {product.variants.length > 0 ? (
            <div className="mt-2 flex flex-col gap-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Sizes to be deleted</p>
              {product.variants.map((v) => (
                <div key={v.label} className="flex items-center justify-between text-xs">
                  <span><b>{v.label}</b>{v.barcode ? <span className="ml-1 text-gray-400">· {v.barcode}</span> : ""}</span>
                  <span className="text-gray-500">{v.stock} in stock</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-gray-500">{product.currentStock} {product.unit} in stock</p>
          )}
        </div>

        {hasStock && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            This product still has <b>{product.currentStock} {product.unit}</b> in stock — that stock will no longer be counted after deleting.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          <button onClick={confirmDelete} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Trash2 size={15} /> {busy ? "Deleting…" : "Delete product"}
          </button>
        </div>
      </div>
    </Modal>
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
  const removeVariant = (i: number) =>
    setVariants((vs) => {
      const v = vs[i];
      // Confirm before deleting a size that already has stock (data would be lost on save).
      if (v && v.existingStock != null && v.existingStock > 0) {
        if (!confirm(`Delete size "${v.label}"? It currently has ${v.existingStock} in stock — that stock will be removed when you save.\n\nNote: this only changes the product. Past purchases of this size are kept (they are a record of what you bought). To undo a purchase, edit or delete it on the Purchases page.`)) return vs;
      }
      return vs.filter((_, idx) => idx !== i);
    });

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
            <input name="salePriceRupees" type="number" step="0.01" required onFocus={(e) => e.currentTarget.select()}
              defaultValue={product ? (product.salePrice ? toRupees(product.salePrice) : "") : ""} placeholder="525.00" className={inputCls} />
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
            <input name="openingStock" type="number" min={0} defaultValue="" placeholder="0" className={inputCls} />
          </Field>
        )}
        {hasVariants ? (
          // With sizes, each size has its own alert below — keep the product-level
          // value untouched (don't overwrite existing data) via a hidden field.
          <input type="hidden" name="minStock" value={product?.minStock ?? 0} />
        ) : (
          <Field label="Low-stock alert at" hint="You'll see a low-stock warning when the quantity falls to this number. Set 0 for no alert.">
            <input name="minStock" type="number" min={0} defaultValue={product?.minStock || ""} placeholder="0" className={inputCls} />
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
                    <input type="number" min={0} value={v.openingStock || ""} placeholder="0" onChange={(e) => patchVariant(i, { openingStock: Math.max(0, Number(e.target.value)) })} className={`${inputCls} w-full`} />
                  )}
                  <input type="number" min={0} step="0.01" value={v.priceRupees} onFocus={(e) => e.currentTarget.select()} onChange={(e) => patchVariant(i, { priceRupees: e.target.value })} title="Sale price for this size" placeholder="599" className={`${inputCls} w-full`} />
                  <input type="number" min={0} value={v.minStock || ""} placeholder="0" onChange={(e) => patchVariant(i, { minStock: Math.max(0, Number(e.target.value)) })} title="Low-stock alert for this size" className={`${inputCls} w-full`} />
                  <button type="button" onClick={() => removeVariant(i)} className="flex justify-center text-gray-400 hover:text-red-600" title="Delete this size"><Trash2 size={15} /></button>
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
              <input name="discountValue" type="number" min={0} step="0.01" placeholder="0"
                defaultValue={product ? ((product.discountUnit === "₹" ? toRupees(product.discount) : product.discount) || "") : ""}
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

const ADJ_TYPES = [
  { k: "INCREASE", label: "Increase", sign: "+", on: "bg-emerald-600" },
  { k: "DECREASE", label: "Decrease", sign: "−", on: "bg-amber-600" },
  { k: "DAMAGE", label: "Damage", sign: "−", on: "bg-orange-600" },
  { k: "LOSS", label: "Loss", sign: "−", on: "bg-red-600" },
] as const;
type AdjType = (typeof ADJ_TYPES)[number]["k"];

function StockModal({ product, onClose, onSaved }: { product: ProductDTO; onClose: () => void; onSaved: () => void }) {
  const router = useRouter();
  const hasVariants = product.variants.length > 0;
  const [label, setLabel] = useState(hasVariants ? product.variants[0].label : "");
  const [type, setType] = useState<AdjType>("INCREASE");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const current = hasVariants ? (product.variants.find((v) => v.label === label)?.stock ?? 0) : product.currentStock;
  const q = Number(qty) || 0;
  const delta = type === "INCREASE" ? q : -q;
  const next = current + delta;

  async function save() {
    setError("");
    if (q < 1) return setError("Enter a quantity (1 or more)");
    if (reason.trim().length < 2) return setError("Please enter a reason");
    if (next < 0) return setError(`Only ${current} in stock`);
    setSaving(true);
    const r = await adjustStock({ id: product.id, label: hasVariants ? label : "", adjustmentType: type, quantity: q, reason: reason.trim(), referenceNo: ref.trim() });
    setSaving(false);
    if (!r.ok) return setError(r.error ?? "Could not update");
    router.refresh();
    onSaved();
  }

  return (
    <Modal title={`Adjust stock — ${product.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {hasVariants && (
          <Field label="Which variant">
            <select value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls}>
              {product.variants.map((v) => <option key={v.label} value={v.label}>{v.label} — now {v.stock}</option>)}
            </select>
          </Field>
        )}

        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700">Adjustment type</p>
          <div className="grid grid-cols-4 gap-2">
            {ADJ_TYPES.map((t) => (
              <button key={t.k} type="button" onClick={() => setType(t.k)}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${type === t.k ? `${t.on} border-transparent text-white` : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity">
            <input type="number" min={1} value={qty} placeholder="0" onChange={(e) => setQty(e.target.value)} className={inputCls} autoFocus />
          </Field>
          <Field label="Reference (optional)" hint="Invoice / audit / approval reference">
            <input value={ref} onChange={(e) => setRef(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="Reason" hint="Required — why the stock is changing (e.g. recount, torn piece, theft).">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Physical recount correction" className={inputCls} />
        </Field>

        <div className="flex items-center justify-center gap-3 rounded-xl bg-gray-50 py-3 text-sm">
          <span className="font-semibold text-gray-700">Now {current}</span>
          <span className="text-gray-400">→</span>
          <span className={`font-bold ${next < 0 ? "text-red-600" : next < current ? "text-amber-600" : "text-emerald-600"}`}>New {next}</span>
        </div>

        <p className="text-xs text-gray-400">This is logged in the stock ledger with your name, the reason and the time.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-gray-300 px-4 py-2 text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? "Saving…" : "Apply adjustment"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const READY_GST = ["0", "5", "12", "18", "28"];

function ReadyModal({ product, onClose, onSaved }: { product: ProductDTO; onClose: () => void; onSaved: () => void }) {
  const hasVariants = product.variants.length > 0;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [gst, setGst] = useState(String(product.taxRate ?? 0));
  const [singleSell, setSingleSell] = useState(product.salePrice > 0 ? String(toRupees(product.salePrice)) : "");
  const [singleMrp, setSingleMrp] = useState(product.mrp != null ? String(toRupees(product.mrp)) : "");
  const [sell, setSell] = useState<Record<string, string>>(
    Object.fromEntries(product.variants.map((v) => [v.label, v.price != null ? String(toRupees(v.price)) : ""]))
  );
  const [mrp, setMrp] = useState<Record<string, string>>(
    Object.fromEntries(product.variants.map((v) => [v.label, v.mrp != null ? String(toRupees(v.mrp)) : ""]))
  );

  async function save() {
    setError("");
    if (hasVariants) {
      for (const v of product.variants) {
        if (!sell[v.label] || Number(sell[v.label]) <= 0) return setError(`Enter a selling price for ${v.label}`);
      }
    } else if (!singleSell || Number(singleSell) <= 0) {
      return setError("Enter a valid selling price");
    }
    setSaving(true);
    const res = await markReady({
      id: product.id,
      salePriceRupees: hasVariants ? 0 : singleSell,
      mrpRupees: hasVariants ? undefined : (singleMrp || undefined),
      taxRate: gst,
      variantPrices: hasVariants
        ? product.variants.map((v) => ({ label: v.label, priceRupees: sell[v.label], mrpRupees: mrp[v.label] || undefined }))
        : undefined,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onSaved();
  }

  const costStr = product.costPrice > 0 ? formatINR(product.costPrice) : "—";

  return (
    <Modal title={`Ready to sell — ${product.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-500">Set the <b>selling price</b> (and MRP) so staff can bill it. Cost &amp; stock are shown for reference.</p>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Cost (bought at)" value={costStr} tone="amber" />
          <Stat label="Total stock" value={`${product.currentStock} pcs`} tone="gray" />
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">GST rate</label>
            <select value={gst} onChange={(e) => setGst(e.target.value)} className={`${inputCls} w-full`}>
              {READY_GST.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </div>
        </div>

        {hasVariants ? (
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <tr><th className="px-3 py-2">Variant</th><th className="px-2">Stock</th><th className="px-2">Cost</th><th className="px-2">MRP ₹</th><th className="px-2">Sell ₹</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {product.variants.map((v) => (
                  <tr key={v.label}>
                    <td className="px-3 py-2 font-medium text-gray-700">{v.label}</td>
                    <td className="px-2 text-gray-500">{v.stock}</td>
                    <td className="px-2 text-gray-500">{costStr}</td>
                    <td className="px-2"><input type="number" min={0} value={mrp[v.label] ?? ""} onChange={(e) => setMrp((m) => ({ ...m, [v.label]: e.target.value }))} placeholder="—" className={`${inputCls} w-20`} /></td>
                    <td className="px-2"><input type="number" min={0} value={sell[v.label] ?? ""} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setSell((s) => ({ ...s, [v.label]: e.target.value }))} placeholder="price" className={`${inputCls} w-20`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="MRP (₹)" hint="Printed max price (optional)">
              <input type="number" min={0} value={singleMrp} onChange={(e) => setSingleMrp(e.target.value)} placeholder="e.g. 899" className={`${inputCls} w-full`} />
            </Field>
            <Field label="Selling price (₹)" hint="What the customer pays">
              <input type="number" min={0} value={singleSell} onChange={(e) => setSingleSell(e.target.value)} placeholder="e.g. 599" className={`${inputCls} w-full`} autoFocus />
            </Field>
          </div>
        )}

        {product.costPrice > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Keep the selling price above the cost (<b>{costStr}</b>) to make a profit.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-gray-300 px-4 py-2 text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? "Saving…" : "Make ready to sell"}</button>
        </div>
      </div>
    </Modal>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "amber" | "gray" }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${tone === "amber" ? "border-amber-100 bg-amber-50" : "border-gray-200 bg-gray-50"}`}>
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <p className="text-sm font-bold text-gray-800">{value}</p>
    </div>
  );
}
