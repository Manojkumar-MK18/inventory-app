"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { getContext } from "@/lib/context";
import { requireRole } from "@/lib/session";
import { productRepo } from "@/repositories/productRepo";
import { connectDB } from "@/lib/db";
import { StockMovementModel } from "@/models/StockMovement";
import { toPaise } from "@/lib/money";
import { ProductModel } from "@/models/Product";
import { CategoryModel } from "@/models/Category";
import { productFormSchema, productUpdateSchema, stockAdjustSchema, variantStockAdjustSchema, quickProductSchema, setSellableSchema, markReadySchema } from "@/schemas/product";

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
  taxRate: number;
  currentStock: number;
  minStock: number;
  discount: number; // paise if discountUnit "₹", else percent
  discountUnit: "₹" | "%";
  categoryName: string;
  variants: { label: string; barcode: string; stock: number; minStock: number; price: number | null }[];
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
    taxRate: p.taxRate ?? 0,
    currentStock: p.currentStock ?? 0,
    minStock: p.minStock ?? 0,
    discount: p.discount ?? 0,
    discountUnit: (p.discountUnit as "₹" | "%") ?? "₹",
    categoryName: p.categoryName ?? "",
    variants: (p.variants ?? []).map((v: any) => ({
      label: v.label,
      barcode: v.barcode ?? "",
      stock: v.stock ?? 0,
      minStock: v.minStock ?? 0,
      price: v.price ?? null,
    })),
    sellable: p.sellable !== false,
  }));
}

/** Build variant subdocs + total stock from the form input. */
function buildVariants(input: { label: string; barcode?: string; openingStock: number; minStock?: number; priceRupees?: number }[]) {
  const variants = input.map((v) => ({
    label: v.label.trim(),
    barcode: v.barcode || "",
    stock: v.openingStock,
    minStock: v.minStock ?? 0,
    price: v.priceRupees != null && v.priceRupees !== undefined ? toPaise(v.priceRupees) : null,
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
  requireRole(ctx, ["OWNER", "MANAGER"]);

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
      unit: d.unit || "pcs",
      salePrice: toPaise(d.salePriceRupees),
      taxRate: d.taxRate,
      currentStock,
      minStock: d.minStock,
      discount: discountToStored(d.discountValue, d.discountUnit),
      discountUnit: d.discountUnit,
      categoryName: (d.categoryName || "").trim(),
      variants,
      isActive: true,
    });
    await ensureCategory(bId, d.categoryName || "");

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
  requireRole(ctx, ["OWNER", "MANAGER"]);

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

    // Reconcile variants by label: keep existing stock, new labels get their opening stock.
    const hasVariants = (d.variants?.length ?? 0) > 0;
    if (hasVariants) {
      const stockByLabel = new Map((existing.variants ?? []).map((v: any) => [v.label, v.stock]));
      const variants = d.variants!.map((v) => ({
        label: v.label.trim(),
        barcode: v.barcode || "",
        stock: stockByLabel.get(v.label.trim()) ?? v.openingStock,
        minStock: v.minStock ?? 0,
        price: v.priceRupees != null ? toPaise(v.priceRupees) : null,
      }));
      set.variants = variants;
      set.currentStock = variants.reduce((a, v) => a + v.stock, 0);
    } else {
      set.variants = [];
    }

    const updated = await productRepo(ctx).update(d.id, set);
    if (!updated) return { ok: false, error: "Product not found" };
    await ensureCategory(bId, d.categoryName || "");
  } catch (e: any) {
    if (e?.code === 11000) return { ok: false, error: "A product with this SKU already exists" };
    return { ok: false, error: "Could not update the product" };
  }

  revalidatePath("/products");
  revalidatePath("/pos");
  return { ok: true };
}

/** Set stock to an exact count; records the difference as an ADJUSTMENT movement. */
export async function adjustStock(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requireRole(ctx, ["OWNER", "MANAGER"]);

  const parsed = stockAdjustSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid stock value" };
  const { id, newCount } = parsed.data;

  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const product = await ProductModel.findOne({ businessId: bId, _id: id });
  if (!product) return { ok: false, error: "Product not found" };

  const delta = newCount - product.currentStock;
  if (delta === 0) return { ok: true };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await ProductModel.updateOne(
        { businessId: bId, _id: id },
        { $set: { currentStock: newCount } },
        { session }
      );
      await StockMovementModel.create(
        [{ businessId: bId, productId: product._id, type: "ADJUSTMENT", qty: delta, refType: "ADJUSTMENT" }],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  revalidatePath("/products");
  revalidatePath("/pos");
  return { ok: true };
}

/** Set one variant's stock to an exact count; records the difference as an ADJUSTMENT. */
export async function adjustVariantStock(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requireRole(ctx, ["OWNER", "MANAGER"]);

  const parsed = variantStockAdjustSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid stock value" };
  const { id, label, newCount } = parsed.data;

  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const product = await ProductModel.findOne({ businessId: bId, _id: id });
  if (!product) return { ok: false, error: "Product not found" };
  const variant = (product.variants ?? []).find((v: any) => v.label === label);
  if (!variant) return { ok: false, error: "Size not found" };

  const delta = newCount - variant.stock;
  if (delta === 0) return { ok: true };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await ProductModel.updateOne(
        { businessId: bId, _id: id, "variants.label": label },
        { $set: { "variants.$.stock": newCount }, $inc: { currentStock: delta } },
        { session }
      );
      await StockMovementModel.create(
        [{ businessId: bId, productId: product._id, variantLabel: label, type: "ADJUSTMENT", qty: delta, refType: "ADJUSTMENT" }],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  revalidatePath("/products");
  revalidatePath("/pos");
  return { ok: true };
}

/** Quick-add a draft product from the Purchase screen (not for sale until completed). */
export async function quickCreateProduct(raw: unknown): Promise<{ ok: true; product: ProductDTO } | { ok: false; error: string }> {
  const ctx = await getContext();
  requireRole(ctx, ["OWNER", "MANAGER"]);
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
        salePrice: 0, taxRate: 0, currentStock: 0, minStock: 0,
        discount: 0, discountUnit: "₹", categoryName,
        variants: variants.map((v) => ({ label: v.label, barcode: "", stock: 0, minStock: 0, price: null })),
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
  requireRole(ctx, ["OWNER", "MANAGER"]);
  const parsed = markReadySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Enter a valid selling price" };
  const { id, salePriceRupees, taxRate, variantPrices } = parsed.data;

  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const product = await ProductModel.findOne({ businessId: bId, _id: id });
  if (!product) return { ok: false, error: "Product not found" };

  const hasVariants = (product.variants ?? []).length > 0;
  if (hasVariants) {
    // Each size has its own selling price.
    const priceByLabel = new Map((variantPrices ?? []).map((v) => [v.label, toPaise(v.priceRupees)]));
    for (const v of product.variants) {
      if (!priceByLabel.has(v.label) || priceByLabel.get(v.label)! <= 0) {
        return { ok: false, error: `Enter a price for size ${v.label}` };
      }
    }
    product.variants.forEach((v: any) => { v.price = priceByLabel.get(v.label)!; });
    // Product-level salePrice = lowest size price (fallback/display only).
    product.salePrice = Math.min(...product.variants.map((v: any) => v.price));
  } else {
    if (salePriceRupees <= 0) return { ok: false, error: "Enter a valid selling price" };
    product.salePrice = toPaise(salePriceRupees);
  }
  product.taxRate = taxRate;
  product.sellable = true;
  await product.save();

  revalidatePath("/products");
  revalidatePath("/pos");
  return { ok: true };
}

/** Pull a product back to draft (stop selling). */
export async function setSellable(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requireRole(ctx, ["OWNER", "MANAGER"]);
  const parsed = setSellableSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  await connectDB();
  const updated = await productRepo(ctx).update(parsed.data.id, { sellable: parsed.data.sellable });
  if (!updated) return { ok: false, error: "Product not found" };
  revalidatePath("/products");
  revalidatePath("/pos");
  return { ok: true };
}
