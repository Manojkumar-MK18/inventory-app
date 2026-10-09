"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { getContext } from "@/lib/context";
import { requirePerm } from "@/lib/session";
import { purchaseRepo } from "@/repositories/purchaseRepo";
import { connectDB } from "@/lib/db";
import { PurchaseModel } from "@/models/Purchase";
import { ProductModel } from "@/models/Product";
import { StockMovementModel } from "@/models/StockMovement";
import { SupplierModel } from "@/models/Supplier";
import { toPaise } from "@/lib/money";
import { createPurchaseSchema, editPurchaseSchema } from "@/schemas/purchase";

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface PurchaseListRow {
  id: string;
  date: string;
  supplierName: string;
  supplierInvoiceNo: string;
  itemCount: number;
  totalCost: number;
}

export interface PurchaseDetail {
  id: string;
  date: string;
  supplierName: string;
  supplierInvoiceNo: string;
  paymentMethod: string;
  totalCost: number;
  items: { productId: string; variantLabel: string; name: string; sku: string; qty: number; cost: number; lineTotal: number }[];
}

export async function listPurchases(limit = 100): Promise<PurchaseListRow[]> {
  const ctx = await getContext();
  const rows = await purchaseRepo(ctx).list(limit);
  return rows.map((p: any) => ({
    id: p._id.toString(),
    date: new Date(p.date).toISOString(),
    supplierName: p.supplierName || "",
    supplierInvoiceNo: p.supplierInvoiceNo || "",
    itemCount: p.items?.length ?? 0,
    totalCost: p.totalCost ?? 0,
  }));
}

export async function createPurchase(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requirePerm(ctx, "purchases");

  const parsed = createPurchaseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid purchase" };
  }
  const d = parsed.data;

  try {
    await purchaseRepo(ctx).create({
      supplierName: d.supplierName || "",
      supplierInvoiceNo: d.supplierInvoiceNo || "",
      paymentMethod: d.paymentMethod,
      items: d.items.map((i) => ({ productId: i.productId, qty: i.qty, cost: toPaise(i.costRupees), variantLabel: i.variantLabel })),
    });
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Could not save the purchase" };
  }

  revalidatePath("/purchases");
  revalidatePath("/products");
  revalidatePath("/pos");
  revalidatePath("/suppliers");
  return { ok: true };
}

/** Full detail of one purchase (for the View dialog). */
export async function getPurchase(id: string): Promise<PurchaseDetail | null> {
  const ctx = await getContext();
  await connectDB();
  const p: any = await PurchaseModel.findOne({
    businessId: new mongoose.Types.ObjectId(ctx.businessId),
    _id: id,
  }).lean();
  if (!p) return null;
  // Look up each product's SKU/code to show alongside the item name.
  const ids = [...new Set((p.items ?? []).map((i: any) => i.productId.toString()))];
  const prods = await ProductModel.find({ businessId: new mongoose.Types.ObjectId(ctx.businessId), _id: { $in: ids } }, { sku: 1 }).lean();
  const skuById = new Map(prods.map((pr: any) => [pr._id.toString(), pr.sku]));
  return {
    id: p._id.toString(),
    date: new Date(p.date).toISOString(),
    supplierName: p.supplierName || "",
    supplierInvoiceNo: p.supplierInvoiceNo || "",
    paymentMethod: p.paymentMethod || "PAID",
    totalCost: p.totalCost ?? 0,
    items: (p.items ?? []).map((i: any) => ({
      productId: i.productId.toString(),
      variantLabel: i.variantLabel ?? "",
      name: i.name,
      sku: skuById.get(i.productId.toString()) ?? "",
      qty: i.qty,
      cost: i.cost,
      lineTotal: i.qty * i.cost,
    })),
  };
}

const supKey = (name: string) => name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const keyOf = (pid: string, vl?: string) => `${pid}::${vl ?? ""}`;

/** Full edit of a purchase: change products, quantities, cost, supplier, invoice, payment.
 *  Adjusts stock by the net difference, updates cost, and fixes supplier dues. */
export async function editPurchase(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requirePerm(ctx, "purchases");
  const parsed = editPurchaseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details" };
  const d = parsed.data;

  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const old: any = await PurchaseModel.findOne({ businessId: bId, _id: d.id });
  if (!old) return { ok: false, error: "Purchase not found" };

  // Old vs new quantity per product+size → net delta to apply to stock.
  const oldQty = new Map<string, number>();
  for (const it of old.items ?? []) oldQty.set(keyOf(it.productId.toString(), it.variantLabel), (oldQty.get(keyOf(it.productId.toString(), it.variantLabel)) ?? 0) + it.qty);

  const ids = d.items.map((i) => new mongoose.Types.ObjectId(i.productId));
  const products = await ProductModel.find({ businessId: bId, _id: { $in: ids } });
  const byId = new Map(products.map((p: any) => [p._id.toString(), p]));

  let newTotal = 0;
  const newItems: any[] = [];
  const newQty = new Map<string, number>();
  const newCostByProduct = new Map<string, number>();
  for (const i of d.items) {
    const p: any = byId.get(i.productId);
    if (!p) return { ok: false, error: "A product was not found" };
    if ((p.variants ?? []).length > 0 && !i.variantLabel) return { ok: false, error: `Select a size for ${p.name}` };
    const cost = toPaise(i.costRupees);
    newItems.push({ productId: p._id, name: i.variantLabel ? `${p.name} (${i.variantLabel})` : p.name, variantLabel: i.variantLabel ?? "", qty: i.qty, cost, taxRate: p.taxRate });
    const k = keyOf(i.productId, i.variantLabel);
    newQty.set(k, (newQty.get(k) ?? 0) + i.qty);
    newTotal += i.qty * cost;
    newCostByProduct.set(i.productId, cost);
  }

  const keys = new Set<string>([...oldQty.keys(), ...newQty.keys()]);

  // Pre-check: no change may push stock below zero (i.e. you reduced a qty whose items were sold).
  for (const k of keys) {
    const delta = (newQty.get(k) ?? 0) - (oldQty.get(k) ?? 0);
    if (delta >= 0) continue;
    const [pid, vl] = k.split("::");
    const p: any = byId.get(pid) ?? (await ProductModel.findOne({ businessId: bId, _id: pid }));
    if (!p) continue;
    const have = vl ? ((p.variants ?? []).find((v: any) => v.label === vl)?.stock ?? 0) : p.currentStock;
    if (have + delta < 0) return { ok: false, error: `Can't save — would make "${p.name}${vl ? ` (${vl})` : ""}" stock negative (some already sold)` };
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Apply net stock deltas.
      for (const k of keys) {
        const delta = (newQty.get(k) ?? 0) - (oldQty.get(k) ?? 0);
        if (delta === 0) continue;
        const [pid, vl] = k.split("::");
        if (vl) {
          await ProductModel.updateOne({ businessId: bId, _id: pid, "variants.label": vl }, { $inc: { "variants.$.stock": delta, currentStock: delta } }, { session });
        } else {
          await ProductModel.updateOne({ businessId: bId, _id: pid }, { $inc: { currentStock: delta } }, { session });
        }
        await StockMovementModel.create([{ businessId: bId, productId: pid, variantLabel: vl, type: "ADJUSTMENT", qty: delta, refType: "PURCHASE" }], { session });
      }
      // Update cost to the edited cost for each product in the new list.
      for (const [pid, cost] of newCostByProduct) {
        await ProductModel.updateOne({ businessId: bId, _id: pid }, { $set: { costPrice: cost } }, { session });
      }
      // Fix supplier dues: remove the old credit amount, add the new one.
      if (old.paymentMethod === "CREDIT" && (old.supplierName || "").trim()) {
        await SupplierModel.updateOne({ businessId: bId, name: { $regex: `^${supKey(old.supplierName)}$`, $options: "i" } }, { $inc: { balanceDue: -old.totalCost } }, { session });
      }
      if (d.paymentMethod === "CREDIT" && (d.supplierName || "").trim()) {
        const name = d.supplierName!.trim();
        let sup = await SupplierModel.findOne({ businessId: bId, name: { $regex: `^${supKey(name)}$`, $options: "i" } }).session(session);
        if (!sup) { const c = await SupplierModel.create([{ businessId: bId, name }], { session }); sup = c[0]; }
        await SupplierModel.updateOne({ businessId: bId, _id: sup._id }, { $inc: { balanceDue: newTotal } }, { session });
      }
      // Save the purchase row.
      old.items = newItems;
      old.totalCost = newTotal;
      old.supplierName = d.supplierName || "";
      old.supplierInvoiceNo = d.supplierInvoiceNo || "";
      old.paymentMethod = d.paymentMethod;
      await old.save({ session });
    });
  } finally {
    await session.endSession();
  }

  revalidatePath("/purchases");
  revalidatePath("/products");
  revalidatePath("/pos");
  revalidatePath("/suppliers");
  return { ok: true };
}

/** Delete a purchase and REVERSE its effects: remove the stock it added, and (if it was
 *  on credit) reduce the supplier's dues. Blocked if the stock was already sold. */
export async function deletePurchase(id: string): Promise<ActionResult> {
  const ctx = await getContext();
  requirePerm(ctx, "purchases");
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const p: any = await PurchaseModel.findOne({ businessId: bId, _id: id });
  if (!p) return { ok: false, error: "Purchase not found" };

  // Check there's enough stock to reverse (you can't un-buy items you've already sold).
  for (const it of p.items ?? []) {
    const prod: any = await ProductModel.findOne({ businessId: bId, _id: it.productId });
    if (!prod) continue;
    // If this size was later removed from the product, its stock is already gone —
    // nothing to reverse, so don't block (and we'll skip the decrement below).
    if (it.variantLabel && !(prod.variants ?? []).some((v: any) => v.label === it.variantLabel)) continue;
    const have = it.variantLabel
      ? (prod.variants ?? []).find((v: any) => v.label === it.variantLabel)?.stock ?? 0
      : prod.currentStock;
    if (have < it.qty) {
      return { ok: false, error: `Can't delete — only ${have} of "${it.name}" left in stock (some already sold)` };
    }
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const it of p.items ?? []) {
        if (it.variantLabel) {
          await ProductModel.updateOne(
            { businessId: bId, _id: it.productId, "variants.label": it.variantLabel },
            { $inc: { "variants.$.stock": -it.qty, currentStock: -it.qty } },
            { session }
          );
        } else {
          await ProductModel.updateOne(
            { businessId: bId, _id: it.productId },
            { $inc: { currentStock: -it.qty } },
            { session }
          );
        }
        await StockMovementModel.create(
          [{ businessId: bId, productId: it.productId, variantLabel: it.variantLabel ?? "", type: "PURCHASE_RETURN", qty: -it.qty, refType: "PURCHASE" }],
          { session }
        );
      }
      // Reverse supplier dues if this was a credit purchase.
      if (p.paymentMethod === "CREDIT" && (p.supplierName || "").trim()) {
        const esc = p.supplierName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        await SupplierModel.updateOne(
          { businessId: bId, name: { $regex: `^${esc}$`, $options: "i" } },
          { $inc: { balanceDue: -p.totalCost } },
          { session }
        );
      }
      await PurchaseModel.deleteOne({ businessId: bId, _id: id }, { session });
    });
  } finally {
    await session.endSession();
  }

  revalidatePath("/purchases");
  revalidatePath("/products");
  revalidatePath("/pos");
  revalidatePath("/suppliers");
  return { ok: true };
}
