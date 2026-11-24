"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { getContext } from "@/lib/context";
import { requirePerm } from "@/lib/session";
import { productRepo } from "@/repositories/productRepo";
import { connectDB } from "@/lib/db";
import { StockMovementModel } from "@/models/StockMovement";
import { toPaise } from "@/lib/money";
import { makeEan13 } from "@/lib/barcode";
import { ProductModel } from "@/models/Product";
import { CategoryModel } from "@/models/Category";
import { BrandModel } from "@/models/Brand";
import { productFormSchema, productUpdateSchema, stockAdjustSchema, quickProductSchema, setSellableSchema, markReadySchema } from "@/schemas/product";

/** Upsert a category so it shows up in the dropdown next time. */
async function ensureCategory(businessId: mongoose.Types.ObjectId, name: string) {
  const clean = name.trim();
  if (!clean) return;
  await CategoryModel.updateOne(
    { businessId, name: clean },
    { $setOnInsert: { businessId, name: clean } },
    { upsert: true }
  );
}

/** Upsert a brand so it shows up in the dropdown next time. */
async function ensureBrand(businessId: mongoose.Types.ObjectId, name: string) {
  const clean = name.trim();
  if (!clean) return;
  await BrandModel.updateOne(
    { businessId, name: clean },
    { $setOnInsert: { businessId, name: clean } },
    { upsert: true }
  );
}

/** Brand names for the dropdown. */
export async function listBrands(): Promise<string[]> {
  const ctx = await getContext();
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const rows = await BrandModel.find({ businessId: bId }).sort({ name: 1 }).lean<{ name: string }[]>();
  return rows.map((r) => r.name);
}

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Plain, serializable product shape for client components. */
export interface ProductDTO {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  hsn: string | null;
  unit: string;
  salePrice: number; // paise
  costPrice: number; // paise — weighted-average buy cost (for deciding a sell price)
  taxRate: number;
  currentStock: number;
  damagedStock: number; // written-off damaged pieces (not sellable)
  minStock: number;
  discount: number; // paise if discountUnit "₹", else percent
  discountUnit: "₹" | "%";
  categoryName: string;
  brandName: string;
  department: string;
  description: string;
  fabric: string;
  imageUrl: string;
  mrp: number | null; // paise
  variants: {
    label: string; size: string; color: string; fit: string;
    barcode: string; stock: number; minStock: number;
    price: number | null; mrp: number | null; costPrice: number | null; locationCode: string;
  }[];
  sellable: boolean;
}

export async function listProducts(opts?: { sellableOnly?: boolean }): Promise<ProductDTO[]> {
  const ctx = await getContext();
  const filter: Record<string, unknown> = { isActive: true };
  if (opts?.sellableOnly) filter.sellable = true;
  const rows = await productRepo(ctx).list(filter);
  return rows.map((p: any) => ({
    id: p._id.toString(),
    name: p.name,
    sku: p.sku,
    barcode: p.barcode ?? null,
    hsn: p.hsn ?? null,
    unit: p.unit ?? "pcs",
    salePrice: p.salePrice,
    costPrice: p.costPrice ?? 0,
    taxRate: p.taxRate ?? 0,
    currentStock: p.currentStock ?? 0,
    damagedStock: p.damagedStock ?? 0,
    minStock: p.minStock ?? 0,
    discount: p.discount ?? 0,
    discountUnit: (p.discountUnit as "₹" | "%") ?? "₹",
    categoryName: p.categoryName ?? "",
    brandName: p.brandName ?? "",
    department: p.department ?? "",
    description: p.description ?? "",
    fabric: p.fabric ?? "",
    imageUrl: p.imageUrl ?? "",
    mrp: p.mrp ?? null,
    variants: (p.variants ?? []).map((v: any) => ({
      label: v.label,
      size: v.size ?? "",
      color: v.color ?? "",
      fit: v.fit ?? "",
      barcode: v.barcode ?? "",
      stock: v.stock ?? 0,
      minStock: v.minStock ?? 0,
      price: v.price ?? null,
      mrp: v.mrp ?? null,
      costPrice: v.costPrice ?? null,
      locationCode: v.locationCode ?? "",
    })),
    sellable: p.sellable !== false,
  }));
}

type VariantInput = {
  label?: string; size?: string; color?: string; fit?: string;
  barcode?: string; openingStock: number; minStock?: number;
  priceRupees?: number; mrpRupees?: number; costRupees?: number; locationCode?: string;
};

/** Combined display key ("Black / M"), computed from size/colour/fit when not given. */
function computeLabel(v: VariantInput): string {
  if (v.label && v.label.trim()) return v.label.trim();
  const parts = [v.color, v.size, v.fit].map((x) => (x ?? "").trim()).filter(Boolean);
  return parts.join(" / ") || "—";
}

/** Build variant subdocs + total stock from the form input. */
function buildVariants(input: VariantInput[]) {
  const variants = input.map((v) => ({
    label: computeLabel(v),
    size: (v.size ?? "").trim(),
    color: (v.color ?? "").trim(),
    fit: (v.fit ?? "").trim(),
    barcode: v.barcode || "",
    stock: v.openingStock,
    minStock: v.minStock ?? 0,
    price: v.priceRupees != null ? toPaise(v.priceRupees) : null,
    mrp: v.mrpRupees != null ? toPaise(v.mrpRupees) : null,
    costPrice: v.costRupees != null ? toPaise(v.costRupees) : null,
    locationCode: (v.locationCode ?? "").trim(),
  }));
  const totalStock = variants.reduce((a, v) => a + v.stock, 0);
  return { variants, totalStock };
}

/** Store a discount form value as the model's discount field (paise for ₹, percent for %). */
function discountToStored(value: number, unit: "₹" | "%"): number {
  return unit === "₹" ? toPaise(value) : value;
}

export async function createProduct(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requirePerm(ctx, "products");

  const parsed = productFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the product details" };
  const d = parsed.data;

  const hasVariants = (d.variants?.length ?? 0) > 0;
  const { variants, totalStock } = hasVariants ? buildVariants(d.variants!) : { variants: [], totalStock: 0 };
  const currentStock = hasVariants ? totalStock : d.openingStock;

  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  try {
    const product = await productRepo(ctx).create({
      name: d.name,
      sku: d.sku,
      barcode: d.barcode || undefined,
      hsn: d.hsn || undefined,
      categoryName: (d.categoryName || "").trim(),
      brandName: (d.brandName || "").trim(),
      department: (d.department || "").trim(),
      description: (d.description || "").trim(),
      fabric: (d.fabric || "").trim(),
      imageUrl: d.imageUrl || "",
      mrp: d.mrpRupees != null ? toPaise(d.mrpRupees) : null,
      unit: d.unit || "pcs",
      salePrice: toPaise(d.salePriceRupees),
      taxRate: d.taxRate,
      currentStock,
      minStock: d.minStock,
      discount: discountToStored(d.discountValue, d.discountUnit),
      discountUnit: d.discountUnit,
      variants,
      isActive: true,
    });
    await ensureCategory(bId, d.categoryName || "");
    await ensureBrand(bId, d.brandName || "");

    // Record opening stock as movements (per variant if any) — the ledger is the source of truth.
    if (hasVariants) {
      for (const v of variants) {
        if (v.stock > 0) {
          await StockMovementModel.create({ businessId: bId, productId: product._id, variantLabel: v.label, type: "OPENING", qty: v.stock, refType: "OPENING" });
        }
      }
    } else if (d.openingStock > 0) {
      await StockMovementModel.create({ businessId: bId, productId: product._id, type: "OPENING", qty: d.openingStock, refType: "OPENING" });
    }
  } catch (e: any) {
    if (e?.code === 11000) return { ok: false, error: "A product with this SKU already exists" };
    return { ok: false, error: "Could not save the product" };
  }

  revalidatePath("/products");
  revalidatePath("/pos");
  return { ok: true };
}

export async function updateProduct(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requirePerm(ctx, "products");

  const parsed = productUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the product details" };
  const d = parsed.data;

  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  try {
    const existing = await ProductModel.findOne({ businessId: bId, _id: d.id }).lean<{ variants: any[] }>();
    if (!existing) return { ok: false, error: "Product not found" };

    const set: Record<string, unknown> = {
      name: d.name,
      sku: d.sku,
      barcode: d.barcode || undefined,
      hsn: d.hsn || undefined,
      unit: d.unit || "pcs",
      salePrice: toPaise(d.salePriceRupees),
      taxRate: d.taxRate,
      minStock: d.minStock,
      discount: discountToStored(d.discountValue, d.discountUnit),
      discountUnit: d.discountUnit,
      categoryName: (d.categoryName || "").trim(),
    };
    // Only overwrite the new master fields when the caller actually sent them
    // (the old edit form doesn't, so they stay intact).
    if (d.brandName !== undefined) set.brandName = (d.brandName || "").trim();
    if (d.department !== undefined) set.department = (d.department || "").trim();
    if (d.description !== undefined) set.description = (d.description || "").trim();
    if (d.fabric !== undefined) set.fabric = (d.fabric || "").trim();
    if (d.imageUrl !== undefined) set.imageUrl = d.imageUrl || "";
    if (d.mrpRupees !== undefined) set.mrp = d.mrpRupees != null ? toPaise(d.mrpRupees) : null;

    // Reconcile variants by label: keep existing stock + preserve size/colour/mrp/cost.
    const hasVariants = (d.variants?.length ?? 0) > 0;
    if (hasVariants) {
      const exByLabel = new Map((existing.variants ?? []).map((v: any) => [v.label, v]));
      const variants = d.variants!.map((v) => {
        const label = computeLabel(v);
        // Match the existing row by its original label (so renaming size/colour keeps stock).
        const ex: any = exByLabel.get(v.origLabel || label) ?? exByLabel.get(label);
        return {
          label,
          size: (v.size ?? ex?.size ?? "").trim(),
          color: (v.color ?? ex?.color ?? "").trim(),
          fit: (v.fit ?? ex?.fit ?? "").trim(),
          barcode: v.barcode || ex?.barcode || "",
          stock: ex?.stock ?? v.openingStock,
          minStock: v.minStock ?? ex?.minStock ?? 0,
          price: v.priceRupees != null ? toPaise(v.priceRupees) : ex?.price ?? null,
          mrp: v.mrpRupees != null ? toPaise(v.mrpRupees) : ex?.mrp ?? null,
          costPrice: v.costRupees != null ? toPaise(v.costRupees) : ex?.costPrice ?? null,
          locationCode: (v.locationCode ?? ex?.locationCode ?? "").trim(),
        };
      });
      set.variants = variants;
      set.currentStock = variants.reduce((a, v) => a + v.stock, 0);
    } else {
      set.variants = [];
    }

    const updated = await productRepo(ctx).update(d.id, set);
    if (!updated) return { ok: false, error: "Product not found" };
    await ensureCategory(bId, d.categoryName || "");
    if (d.brandName) await ensureBrand(bId, d.brandName);
  } catch (e: any) {
    if (e?.code === 11000) return { ok: false, error: "A product with this SKU already exists" };
    return { ok: false, error: "Could not update the product" };
  }

  revalidatePath("/products");
  revalidatePath("/pos");
  return { ok: true };
}

/**
 * Adjust stock by a signed movement with a MANDATORY reason. Works on a whole
 * product or a single variant (pass `label`). Type: Increase / Decrease / Damage / Loss.
 */
export async function adjustStock(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requirePerm(ctx, "products");

  const parsed = stockAdjustSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the details" };
  const { id, label, adjustmentType, quantity, reason, referenceNo } = parsed.data;

  const delta = (adjustmentType === "INCREASE" ? 1 : -1) * quantity;
  const movementType = adjustmentType === "DAMAGE" ? "DAMAGE" : "ADJUSTMENT";
  const isVariant = !!(label && label.trim());

  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const userId = new mongoose.Types.ObjectId(ctx.userId);
  const product = await ProductModel.findOne({ businessId: bId, _id: id });
  if (!product) return { ok: false, error: "Product not found" };

  let failed = "";
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (isVariant) {
        const variant = (product.variants ?? []).find((v: any) => v.label === label);
        if (!variant) { failed = "Variant not found"; return; }
        if (variant.stock + delta < 0) { failed = `Only ${variant.stock} in stock for ${label}`; return; }
        await ProductModel.updateOne(
          { businessId: bId, _id: id, "variants.label": label },
          { $inc: { "variants.$.stock": delta, currentStock: delta } },
          { session }
        );
      } else {
        if (product.currentStock + delta < 0) { failed = `Only ${product.currentStock} in stock`; return; }
        await ProductModel.updateOne(
          { businessId: bId, _id: id },
          { $inc: { currentStock: delta } },
          { session }
        );
      }
      await StockMovementModel.create(
        [{
          businessId: bId, productId: product._id, variantLabel: isVariant ? label : "",
          type: movementType, qty: delta, refType: movementType,
          reason, referenceNo: referenceNo || "", createdBy: userId,
        }],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
  if (failed) return { ok: false, error: failed };

  revalidatePath("/products");
  revalidatePath("/pos");
  return { ok: true };
}

/** Quick-add a draft product from the Purchase screen (not for sale until completed). */
export async function quickCreateProduct(raw: unknown): Promise<{ ok: true; product: ProductDTO } | { ok: false; error: string }> {
  const ctx = await getContext();
  requirePerm(ctx, "products");
  const parsed = quickProductSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please enter a product name and item code" };
  const d = parsed.data;

  // Sizes: created with 0 stock (stock comes from the purchase) and no per-size price yet.
  const labels = (d.variants ?? []).map((v) => v.label.trim()).filter(Boolean);
  if (new Set(labels).size !== labels.length) return { ok: false, error: "Sizes must be unique" };
  const variants = labels.map((label) => ({ label, barcode: "", stock: 0, price: null }));
  const categoryName = (d.categoryName || "").trim();

  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  try {
    // Draft: no selling price yet (set when marked ready). salePrice 0 as a placeholder.
    const p: any = await productRepo(ctx).create({
      name: d.name,
      sku: d.sku,
      unit: d.unit || "pcs",
      salePrice: 0,
      taxRate: 0,
      currentStock: 0,
      categoryName,
      variants,
      sellable: false, // draft — stocked via the purchase, not sellable yet
      isActive: true,
    });
    await ensureCategory(bId, categoryName);
    revalidatePath("/products");
    revalidatePath("/purchases");
    return {
      ok: true,
      product: {
        id: p._id.toString(), name: p.name, sku: p.sku, barcode: null, hsn: null, unit: p.unit,
        salePrice: 0, costPrice: 0, taxRate: 0, currentStock: 0, damagedStock: 0, minStock: 0,
        discount: 0, discountUnit: "₹", categoryName,
        brandName: "", department: "", description: "", fabric: "", imageUrl: "", mrp: null,
        variants: variants.map((v: any) => ({
          label: v.label, size: v.size ?? "", color: v.color ?? "", fit: v.fit ?? "",
          barcode: "", stock: 0, minStock: 0, price: null, mrp: null, costPrice: null, locationCode: "",
        })),
        sellable: false,
      },
    };
  } catch (e: any) {
    if (e?.code === 11000) return { ok: false, error: "A product with this SKU already exists" };
    return { ok: false, error: "Could not create the product" };
  }
}

/** Mark a draft product ready to sell — requires a selling price (per size if it has sizes). */
export async function markReady(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requirePerm(ctx, "products");
  const parsed = markReadySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Enter a valid selling price" };
  const { id, salePriceRupees, mrpRupees, taxRate, variantPrices } = parsed.data;

  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const product = await ProductModel.findOne({ businessId: bId, _id: id });
  if (!product) return { ok: false, error: "Product not found" };

  const hasVariants = (product.variants ?? []).length > 0;
  if (hasVariants) {
    // Each size has its own selling price (+ optional MRP).
    const byLabel = new Map((variantPrices ?? []).map((v) => [v.label, v]));
    for (const v of product.variants) {
      const row = byLabel.get(v.label);
      if (!row || toPaise(row.priceRupees) <= 0) {
        return { ok: false, error: `Enter a price for size ${v.label}` };
      }
    }
    product.variants.forEach((v: any) => {
      const row = byLabel.get(v.label)!;
      v.price = toPaise(row.priceRupees);
      if (row.mrpRupees != null) v.mrp = toPaise(row.mrpRupees);
    });
    // Product-level salePrice = lowest size price (fallback/display only).
    product.salePrice = Math.min(...product.variants.map((v: any) => v.price));
  } else {
    if (salePriceRupees <= 0) return { ok: false, error: "Enter a valid selling price" };
    product.salePrice = toPaise(salePriceRupees);
    if (mrpRupees != null) product.mrp = toPaise(mrpRupees);
  }
  product.taxRate = taxRate;
  product.sellable = true;
  await product.save();

  revalidatePath("/products");
  revalidatePath("/pos");
  return { ok: true };
}

export interface BarcodeLabel {
  label: string; // size label, or "" for a simple product
  barcode: string;
  name: string; // product name (for the printed label)
  priceRupees: number; // sale price for this label (0 if unset)
}

/**
 * Ensure every sellable "slot" of a product has a barcode, generating unique
 * in-store EAN-13 codes for any that are missing, and return them for printing.
 * For a product with sizes, one barcode per size; otherwise one for the product.
 */
export async function generateBarcodes(raw: unknown): Promise<{ ok: true; productName: string; labels: BarcodeLabel[] } | { ok: false; error: string }> {
  const ctx = await getContext();
  requirePerm(ctx, "products");
  const id = typeof raw === "string" ? raw : (raw as any)?.id;
  if (typeof id !== "string" || id.length !== 24) return { ok: false, error: "Invalid product" };

  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const product = await ProductModel.findOne({ businessId: bId, _id: id });
  if (!product) return { ok: false, error: "Product not found" };

  // Collect existing barcodes across the whole business to keep new ones unique.
  const used = new Set<string>();
  const all = await ProductModel.find({ businessId: bId }, { barcode: 1, "variants.barcode": 1 }).lean();
  for (const p of all as any[]) {
    if (p.barcode) used.add(p.barcode);
    for (const v of p.variants ?? []) if (v.barcode) used.add(v.barcode);
  }
  const freshCode = () => {
    let c = makeEan13();
    while (used.has(c)) c = makeEan13();
    used.add(c);
    return c;
  };

  const hasVariants = (product.variants ?? []).length > 0;
  let changed = false;
  const labels: BarcodeLabel[] = [];

  if (hasVariants) {
    for (const v of product.variants as any[]) {
      if (!v.barcode) { v.barcode = freshCode(); changed = true; }
      labels.push({ label: v.label, barcode: v.barcode, name: product.name, priceRupees: (v.price ?? product.salePrice) / 100 });
    }
  } else {
    if (!product.barcode) { product.barcode = freshCode(); changed = true; }
    labels.push({ label: "", barcode: product.barcode, name: product.name, priceRupees: product.salePrice / 100 });
  }

  if (changed) {
    await product.save();
    revalidatePath("/products");
    revalidatePath("/pos");
  }
  return { ok: true, productName: product.name, labels };
}

/** Pull a product back to draft (stop selling). */
export async function setSellable(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requirePerm(ctx, "products");
  const parsed = setSellableSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  await connectDB();
  const updated = await productRepo(ctx).update(parsed.data.id, { sellable: parsed.data.sellable });
  if (!updated) return { ok: false, error: "Product not found" };
  revalidatePath("/products");
  revalidatePath("/pos");
  return { ok: true };
}

/** Delete a product (soft delete — keeps sale/stock history intact, hides it everywhere). */
export async function deleteProduct(id: string): Promise<ActionResult> {
  const ctx = await getContext();
  requirePerm(ctx, "products");
  if (typeof id !== "string" || id.length !== 24) return { ok: false, error: "Invalid product" };
  await connectDB();
  const updated = await productRepo(ctx).update(id, { isActive: false, sellable: false });
  if (!updated) return { ok: false, error: "Product not found" };
  revalidatePath("/products");
  revalidatePath("/pos");
  return { ok: true };
}
