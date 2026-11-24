"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package, ArrowRight, ArrowLeft, Check, X, Plus, ImageIcon, Boxes, Trash2, RotateCcw,
} from "lucide-react";
import { createProduct } from "@/actions/products";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const STEPS = ["Details", "Sizes & Stock", "Review"];
const DEPARTMENTS = ["Men", "Women", "Kids", "Unisex", "Accessories"];
const GST_RATES = ["0", "5", "12", "18", "28"];
const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL", "28", "30", "32", "34", "36", "Free Size"];
const COLOR_PRESETS = ["Black", "White", "Navy", "Blue", "Grey", "Red", "Green", "Beige", "Maroon"];

type VRow = { sell: string; mrp: string; cost: string; qty: string; reorder: string; location: string };
const emptyRow = (): VRow => ({ sell: "", mrp: "", cost: "", qty: "0", reorder: "0", location: "" });

export function AddProductWizard({
  categories, brands, onClose, onSaved,
}: { categories: string[]; brands: string[]; onClose: () => void; onSaved: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});

  // Step 1
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [department, setDepartment] = useState("Men");
  const [fabric, setFabric] = useState("");
  const [description, setDescription] = useState("");
  const [hsn, setHsn] = useState("");
  const [gst, setGst] = useState("5");
  const [image, setImage] = useState("");

  // Step 2
  const [hasVariants, setHasVariants] = useState(true);
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [customSize, setCustomSize] = useState("");
  const [customColor, setCustomColor] = useState("");
  const [rows, setRows] = useState<Record<string, VRow>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<VRow>(emptyRow());
  // Simple (no variants)
  const [simple, setSimple] = useState<VRow>(emptyRow());

  const variantKeys = useMemo(() => {
    const cs = colors.length ? colors : [""];
    const ss = sizes.length ? sizes : [""];
    const keys: { key: string; color: string; size: string }[] = [];
    for (const c of cs) for (const s of ss) if (c || s) keys.push({ key: `${c}|${s}`, color: c, size: s });
    return keys;
  }, [colors, sizes]);

  // Combos the shop doesn't stock can be removed; keys are stable by color|size.
  const visibleKeys = variantKeys.filter((v) => !removed.has(v.key));
  function removeKey(key: string) { setRemoved((r) => new Set(r).add(key)); }
  function restoreAll() { setRemoved(new Set()); }

  function rowFor(key: string): VRow {
    return rows[key] ?? emptyRow();
  }
  function setRow(key: string, patch: Partial<VRow>) {
    setRows((r) => ({ ...r, [key]: { ...rowFor(key), ...patch } }));
  }
  function applyBulk() {
    setRows((r) => {
      const next = { ...r };
      for (const { key } of visibleKeys) {
        const cur = next[key] ?? emptyRow();
        next[key] = {
          sell: bulk.sell || cur.sell, mrp: bulk.mrp || cur.mrp, cost: bulk.cost || cur.cost,
          qty: bulk.qty !== "0" && bulk.qty !== "" ? bulk.qty : cur.qty,
          reorder: bulk.reorder !== "0" && bulk.reorder !== "" ? bulk.reorder : cur.reorder,
          location: bulk.location || cur.location,
        };
      }
      return next;
    });
    toast.info("Applied to all variants");
  }

  function toggle(list: string[], set: (v: string[]) => void, val: string) {
    set(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  }

  function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 300_000) return toast.error("Image too large (max ~300 KB)");
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  function validateStep1() {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Enter the product name";
    if (sku.trim().length < 1) e.sku = "Enter a SKU / article code";
    setErr(e);
    return Object.keys(e).length === 0;
  }
  function validateStep2() {
    if (hasVariants && visibleKeys.length === 0) {
      toast.error("Pick at least one size or colour");
      return false;
    }
    return true;
  }
  function next() {
    if (step === 0 && !validateStep1()) return;
    if (step === 1 && !validateStep2()) return;
    setStep((s) => s + 1);
  }

  const totalQty = hasVariants
    ? visibleKeys.reduce((a, { key }) => a + (Number(rowFor(key).qty) || 0), 0)
    : Number(simple.qty) || 0;

  async function save() {
    setSaving(true);
    const num = (s: string) => (s === "" ? undefined : Number(s));
    const variants = hasVariants
      ? visibleKeys.map(({ color, size }) => {
          const r = rowFor(`${color}|${size}`);
          return {
            size, color,
            openingStock: Number(r.qty) || 0,
            minStock: Number(r.reorder) || 0,
            priceRupees: num(r.sell),
            mrpRupees: num(r.mrp),
            costRupees: num(r.cost),
            locationCode: r.location,
          };
        })
      : undefined;

    const firstSell = hasVariants ? Number(visibleKeys.map((v) => rowFor(v.key).sell).find(Boolean) || 0) : Number(simple.sell) || 0;

    const res = await createProduct({
      name, sku, hsn, categoryName: category, brandName: brand, department,
      description, fabric, imageUrl: image,
      mrpRupees: hasVariants ? undefined : num(simple.mrp),
      salePriceRupees: firstSell,
      taxRate: Number(gst) || 0,
      openingStock: hasVariants ? 0 : Number(simple.qty) || 0,
      minStock: hasVariants ? 0 : Number(simple.reorder) || 0,
      variants,
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`${name} added`);
    onSaved();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-soft" onClick={(e) => e.stopPropagation()}>
        {/* header + stepper */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Package className="h-5 w-5 text-brand-600" /> Add product
          </h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="border-b border-gray-100 px-6 py-3">
          <div className="flex items-center">
            {STEPS.map((label, i) => (
              <div key={label} className="flex flex-1 items-center last:flex-none">
                <div className="flex items-center gap-2">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i <= step ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-400"}`}>
                    {i < step ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className={`text-xs font-semibold ${i === step ? "text-brand-700" : "text-gray-400"}`}>{label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`mx-3 h-0.5 flex-1 rounded ${i < step ? "bg-brand-600" : "bg-gray-100"}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5">
          {/* STEP 1 — DETAILS */}
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Product name" value={name} onChange={(e) => setName(e.target.value)} error={err.name} hint="Shown on bills. e.g. Men's Casual Shirt" autoFocus />
                <TextField label="SKU / article code" value={sku} onChange={(e) => setSku(e.target.value)} error={err.sku} hint="Your own code to find the item. e.g. SHIRT-001" />
                <div>
                  <TextField label="Category" list="cat-list" value={category} onChange={(e) => setCategory(e.target.value)} hint="Pick or type a new one" />
                  <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <TextField label="Brand" list="brand-list" value={brand} onChange={(e) => setBrand(e.target.value)} hint="Pick or type a new one" />
                  <datalist id="brand-list">{brands.map((b) => <option key={b} value={b} />)}</datalist>
                </div>
                <Select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
                <TextField label="Fabric / material" value={fabric} onChange={(e) => setFabric(e.target.value)} hint="Optional. e.g. Cotton, Silk, Denim" />
                <TextField label="HSN code" value={hsn} onChange={(e) => setHsn(e.target.value)} hint="GST product code (ask your accountant). e.g. 6205" />
                <Select label="GST rate (%)" value={gst} onChange={(e) => setGst(e.target.value)} hint="Tax % charged on this product">
                  {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                </Select>
              </div>
              <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              <div className="flex items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:border-brand-300 hover:bg-brand-50">
                  <ImageIcon className="h-4 w-4" /> {image ? "Change image" : "Add image"}
                  <input type="file" accept="image/*" className="hidden" onChange={onImage} />
                </label>
                {image && <img src={image} alt="" className="h-14 w-14 rounded-lg border border-gray-200 object-cover" />}
              </div>
            </div>
          )}

          {/* STEP 2 — SIZES & STOCK */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div className="flex gap-2">
                <button onClick={() => setHasVariants(true)} className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold ${hasVariants ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-500"}`}>
                  Has sizes / colours
                </button>
                <button onClick={() => setHasVariants(false)} className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold ${!hasVariants ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-500"}`}>
                  Single item (no sizes)
                </button>
              </div>

              {hasVariants ? (
                <>
                  <ChipPicker title="Sizes" tip="Tap the sizes this product comes in. Add your own if it's not listed (e.g. 40, 4XL)." options={SIZE_PRESETS} selected={sizes}
                    onToggle={(v) => toggle(sizes, setSizes, v)}
                    custom={customSize} setCustom={setCustomSize} onAdd={(v) => { if (v && !sizes.includes(v)) setSizes([...sizes, v]); setCustomSize(""); }} />
                  <ChipPicker title="Colours" tip="Tap the colours available. Each size × colour becomes one sellable variant with its own stock & barcode." options={COLOR_PRESETS} selected={colors}
                    onToggle={(v) => toggle(colors, setColors, v)}
                    custom={customColor} setCustom={setCustomColor} onAdd={(v) => { if (v && !colors.includes(v)) setColors([...colors, v]); setCustomColor(""); }} />

                  {variantKeys.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                          {visibleKeys.length} variant{visibleKeys.length !== 1 ? "s" : ""} to create
                        </p>
                        {removed.size > 0 && (
                          <button onClick={restoreAll} className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                            <RotateCcw className="h-3.5 w-3.5" /> Restore {removed.size} removed
                          </button>
                        )}
                      </div>

                      <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
                        A row is created for every size × colour. If you don&rsquo;t stock a combo (e.g. Black only in XL),
                        click the <Trash2 className="inline h-3 w-3" /> on that row to drop it.
                      </p>

                      {/* bulk apply — labeled */}
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="mb-2 text-xs font-semibold text-gray-500">
                          Set the same value for every variant, then tweak individual ones below
                        </p>
                        <div className="flex flex-wrap items-end gap-3">
                          <BulkField label="Sell ₹" v={bulk.sell} on={(x) => setBulk({ ...bulk, sell: x })} />
                          <BulkField label="MRP ₹" v={bulk.mrp} on={(x) => setBulk({ ...bulk, mrp: x })} />
                          <BulkField label="Cost ₹" v={bulk.cost} on={(x) => setBulk({ ...bulk, cost: x })} />
                          <BulkField label="Qty" v={bulk.qty} on={(x) => setBulk({ ...bulk, qty: x })} />
                          <BulkField label="Reorder" v={bulk.reorder} on={(x) => setBulk({ ...bulk, reorder: x })} />
                          <Button variant="tonal" onClick={applyBulk} className="px-4 py-2 text-xs"><Plus className="h-3.5 w-3.5" /> Apply to all</Button>
                        </div>
                      </div>

                      {/* legend */}
                      <p className="text-[11px] leading-relaxed text-gray-400">
                        <b className="text-gray-500">Sell</b> price customer pays ·{" "}
                        <b className="text-gray-500">MRP</b> printed price ·{" "}
                        <b className="text-gray-500">Cost</b> your buy price ·{" "}
                        <b className="text-gray-500">Qty</b> opening stock ·{" "}
                        <b className="text-gray-500">Reorder</b> low-stock alert ·{" "}
                        <b className="text-gray-500">Location</b> rack/shelf
                      </p>

                      {/* variant cards */}
                      <div className="flex flex-col gap-2.5">
                        {visibleKeys.map(({ key, color, size }) => {
                          const r = rowFor(key);
                          return (
                            <div key={key} className="rounded-2xl border border-gray-200 bg-white p-3.5">
                              <div className="mb-3 flex items-center justify-between">
                                <span className="inline-flex items-center gap-2 text-sm font-bold text-gray-800">
                                  {color && <span className="h-3.5 w-3.5 rounded-full border border-gray-200" style={{ backgroundColor: colorHex(color) }} />}
                                  {[color, size].filter(Boolean).join(" · ")}
                                </span>
                                <button onClick={() => removeKey(key)} title="Remove this combo"
                                  className="rounded-full p-1.5 text-gray-300 transition hover:bg-red-50 hover:text-red-500">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                                <LabeledMini label="Sell ₹" v={r.sell} on={(x) => setRow(key, { sell: x })} />
                                <LabeledMini label="MRP ₹" v={r.mrp} on={(x) => setRow(key, { mrp: x })} />
                                <LabeledMini label="Cost ₹" v={r.cost} on={(x) => setRow(key, { cost: x })} />
                                <LabeledMini label="Qty" v={r.qty} on={(x) => setRow(key, { qty: x })} />
                                <LabeledMini label="Reorder" v={r.reorder} on={(x) => setRow(key, { reorder: x })} />
                                <LabeledMini label="Location" ph="A-02" v={r.location} on={(x) => setRow(key, { location: x })} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Selling price (₹)" inputMode="numeric" value={simple.sell} onChange={(e) => setSimple({ ...simple, sell: e.target.value })} />
                  <TextField label="MRP (₹)" inputMode="numeric" value={simple.mrp} onChange={(e) => setSimple({ ...simple, mrp: e.target.value })} />
                  <TextField label="Cost (₹)" inputMode="numeric" value={simple.cost} onChange={(e) => setSimple({ ...simple, cost: e.target.value })} />
                  <TextField label="Opening quantity" inputMode="numeric" value={simple.qty} onChange={(e) => setSimple({ ...simple, qty: e.target.value })} />
                  <TextField label="Reorder level" inputMode="numeric" value={simple.reorder} onChange={(e) => setSimple({ ...simple, reorder: e.target.value })} />
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — REVIEW */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Name" value={name} />
                <Info label="SKU" value={sku} />
                <Info label="Category / Brand" value={[category, brand].filter(Boolean).join(" · ") || "—"} />
                <Info label="Department" value={department} />
                <Info label="GST" value={`${gst}%`} />
                <Info label="Variants" value={hasVariants ? `` : "Single item"} />
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">
                <Boxes className="h-4 w-4" /> Total opening stock: {totalQty} pcs
              </div>
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                After saving, click the 🏷️ barcode button on this product in the list to generate & print labels.
              </p>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <Button variant="outlined" onClick={step === 0 ? onClose : () => setStep((s) => s - 1)} disabled={saving}>
            {step === 0 ? "Cancel" : <><ArrowLeft className="h-4 w-4" /> Back</>}
          </Button>
          {step < 2 ? (
            <Button onClick={next}>Continue <ArrowRight className="h-4 w-4" /></Button>
          ) : (
            <Button onClick={save} loading={saving}><Check className="h-4 w-4" /> {saving ? "Saving…" : "Save product"}</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChipPicker({ title, tip, options, selected, onToggle, custom, setCustom, onAdd }: {
  title: string; tip?: string; options: string[]; selected: string[]; onToggle: (v: string) => void;
  custom: string; setCustom: (v: string) => void; onAdd: (v: string) => void;
}) {
  const extras = selected.filter((s) => !options.includes(s));
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{title}</p>
      {tip && <p className="mb-2 mt-0.5 text-[11px] text-gray-400">{tip}</p>}
      {!tip && <div className="mb-2" />}
      <div className="flex flex-wrap gap-2">
        {[...options, ...extras].map((o) => {
          const on = selected.includes(o);
          return (
            <button key={o} type="button" onClick={() => onToggle(o)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${on ? "border-brand-500 bg-brand-600 text-white" : "border-gray-300 text-gray-600 hover:border-brand-300 hover:bg-brand-50"}`}>
              {o}
            </button>
          );
        })}
        <form onSubmit={(e) => { e.preventDefault(); onAdd(custom.trim()); }} className="flex items-center gap-1">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={`+ add ${title.toLowerCase().replace(/s$/, "")}`}
            className="w-28 rounded-full border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
        </form>
      </div>
    </div>
  );
}

const COLOR_HEX: Record<string, string> = {
  black: "#111827", white: "#ffffff", navy: "#1e3a8a", blue: "#2563eb", grey: "#9ca3af",
  gray: "#9ca3af", red: "#dc2626", green: "#16a34a", beige: "#e7d8b5", maroon: "#7f1d1d",
};
function colorHex(name: string): string {
  return COLOR_HEX[name.trim().toLowerCase()] ?? "#cbd5e1";
}

/** A small labeled input used inside a variant card. */
function LabeledMini({ label, v, on, ph }: { label: string; v: string; on: (x: string) => void; ph?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="pl-0.5 text-[11px] font-medium text-gray-500">{label}</span>
      <input value={v} onChange={(e) => on(e.target.value)} placeholder={ph}
        className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
    </label>
  );
}

/** Labeled input for the "set for all" bulk row. */
function BulkField({ label, v, on }: { label: string; v: string; on: (x: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="pl-1 text-[11px] font-medium text-gray-500">{label}</span>
      <input value={v} onChange={(e) => on(e.target.value)}
        className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 px-3 py-2">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <p className="truncate text-sm font-semibold text-gray-800">{value || "—"}</p>
    </div>
  );
}
