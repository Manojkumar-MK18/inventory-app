"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, X, Plus, Trash2, ImageIcon, Check } from "lucide-react";
import { updateProduct, type ProductDTO } from "@/actions/products";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const DEPARTMENTS = ["", "Men", "Women", "Kids", "Unisex", "Accessories"];
const GST_RATES = ["0", "5", "12", "18", "28"];

const rupees = (p: number | null) => (p == null ? "" : String(Math.round(p / 100)));
const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

type Row = {
  origLabel: string; size: string; color: string; fit: string;
  sell: string; mrp: string; cost: string; reorder: string; location: string; stock: number;
};

export function EditProductModal({
  product, categories, brands, onClose, onSaved,
}: { product: ProductDTO; categories: string[]; brands: string[]; onClose: () => void; onSaved: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});

  const hasVariants = product.variants.length > 0;

  const [name, setName] = useState(product.name);
  const [sku, setSku] = useState(product.sku);
  const [category, setCategory] = useState(product.categoryName);
  const [brand, setBrand] = useState(product.brandName);
  const [department, setDepartment] = useState(product.department);
  const [fabric, setFabric] = useState(product.fabric);
  const [description, setDescription] = useState(product.description);
  const [hsn, setHsn] = useState(product.hsn ?? "");
  const [gst, setGst] = useState(String(product.taxRate ?? 0));
  const [image, setImage] = useState(product.imageUrl);

  const [rows, setRows] = useState<Row[]>(
    product.variants.map((v) => ({
      origLabel: v.label, size: v.size, color: v.color, fit: v.fit,
      sell: rupees(v.price), mrp: rupees(v.mrp), cost: rupees(v.costPrice),
      reorder: String(v.minStock ?? 0), location: v.locationCode, stock: v.stock,
    }))
  );
  const [simple, setSimple] = useState({
    sell: rupees(product.salePrice), mrp: rupees(product.mrp),
    reorder: String(product.minStock ?? 0),
  });

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, { origLabel: "", size: "", color: "", fit: "", sell: "", mrp: "", cost: "", reorder: "0", location: "", stock: 0 }]);
  }
  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  }

  function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 300_000) return toast.error("Image too large (max ~300 KB)");
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function save() {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Enter the product name";
    if (sku.trim().length < 1) e.sku = "Enter a SKU";
    setErr(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    const variants = hasVariants
      ? rows.map((r) => {
          const label = [r.color, r.size, r.fit].map((x) => x.trim()).filter(Boolean).join(" / ") || r.origLabel || "—";
          return {
            label, origLabel: r.origLabel, size: r.size, color: r.color, fit: r.fit,
            openingStock: r.stock, minStock: Number(r.reorder) || 0,
            priceRupees: num(r.sell), mrpRupees: num(r.mrp), costRupees: num(r.cost),
            locationCode: r.location,
          };
        })
      : undefined;
    const firstSell = hasVariants ? Number(rows.map((r) => r.sell).find(Boolean) || 0) : Number(simple.sell) || 0;

    const res = await updateProduct({
      id: product.id,
      name, sku, hsn, unit: product.unit,
      categoryName: category, brandName: brand, department,
      description, fabric, imageUrl: image,
      mrpRupees: hasVariants ? undefined : num(simple.mrp),
      salePriceRupees: firstSell,
      taxRate: Number(gst) || 0,
      minStock: hasVariants ? 0 : Number(simple.reorder) || 0,
      // preserve the product's existing default discount
      discountValue: product.discountUnit === "₹" ? product.discount / 100 : product.discount,
      discountUnit: product.discountUnit,
      variants,
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Product updated");
    onSaved();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-soft" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Package className="h-5 w-5 text-brand-600" /> Edit product
          </h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5">
          {/* Details */}
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Product name" value={name} onChange={(e) => setName(e.target.value)} error={err.name} />
            <TextField label="SKU / article code" value={sku} onChange={(e) => setSku(e.target.value)} error={err.sku} />
            <div>
              <TextField label="Category" list="e-cat" value={category} onChange={(e) => setCategory(e.target.value)} />
              <datalist id="e-cat">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <TextField label="Brand" list="e-brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
              <datalist id="e-brand">{brands.map((b) => <option key={b} value={b} />)}</datalist>
            </div>
            <Select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d || "—"}</option>)}
            </Select>
            <TextField label="Fabric / material" value={fabric} onChange={(e) => setFabric(e.target.value)} />
            <TextField label="HSN code" value={hsn} onChange={(e) => setHsn(e.target.value)} />
            <Select label="GST rate (%)" value={gst} onChange={(e) => setGst(e.target.value)}>
              {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
            </Select>
            <div className="sm:col-span-2">
              <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:border-brand-300 hover:bg-brand-50">
              <ImageIcon className="h-4 w-4" /> {image ? "Change image" : "Add image"}
              <input type="file" accept="image/*" className="hidden" onChange={onImage} />
            </label>
            {image && <img src={image} alt="" className="h-14 w-14 rounded-lg border border-gray-200 object-cover" />}
          </div>

          {/* Variants or simple */}
          {hasVariants ? (
            <>
              <div className="mb-3 mt-6 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{rows.length} variant{rows.length !== 1 ? "s" : ""}</p>
                <button onClick={addRow} className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                  <Plus className="h-3.5 w-3.5" /> Add variant
                </button>
              </div>
              <p className="mb-2 text-[11px] text-gray-400">Stock is read-only here — use the <b className="text-gray-500">Adjust stock</b> button in the list (logs a reason).</p>
              <div className="flex flex-col gap-2.5">
                {rows.map((r, i) => (
                  <div key={i} className="rounded-2xl border border-gray-200 p-3.5">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-800">
                        {[r.color, r.size].filter(Boolean).join(" · ") || r.origLabel || "New variant"}
                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">stock {r.stock}</span>
                      </span>
                      <button onClick={() => removeRow(i)} title="Remove variant" className="rounded-full p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                      <Mini label="Size" v={r.size} on={(x) => setRow(i, { size: x })} />
                      <Mini label="Colour" v={r.color} on={(x) => setRow(i, { color: x })} />
                      <Mini label="Fit" v={r.fit} on={(x) => setRow(i, { fit: x })} />
                      <Mini label="Location" v={r.location} on={(x) => setRow(i, { location: x })} ph="A-02" />
                      <Mini label="Sell ₹" v={r.sell} on={(x) => setRow(i, { sell: x })} />
                      <Mini label="MRP ₹" v={r.mrp} on={(x) => setRow(i, { mrp: x })} />
                      <Mini label="Cost ₹" v={r.cost} on={(x) => setRow(i, { cost: x })} />
                      <Mini label="Reorder" v={r.reorder} on={(x) => setRow(i, { reorder: x })} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <TextField label="Selling price (₹)" inputMode="numeric" value={simple.sell} onChange={(e) => setSimple({ ...simple, sell: e.target.value })} />
              <TextField label="MRP (₹)" inputMode="numeric" value={simple.mrp} onChange={(e) => setSimple({ ...simple, mrp: e.target.value })} />
              <TextField label="Reorder level" inputMode="numeric" value={simple.reorder} onChange={(e) => setSimple({ ...simple, reorder: e.target.value })} />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <Button variant="outlined" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving}><Check className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, v, on, ph }: { label: string; v: string; on: (x: string) => void; ph?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="pl-0.5 text-[11px] font-medium text-gray-500">{label}</span>
      <input value={v} onChange={(e) => on(e.target.value)} placeholder={ph}
        className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
    </label>
  );
}
