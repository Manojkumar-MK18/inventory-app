"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { getContext } from "@/lib/context";
import { requirePerm } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { SaleModel } from "@/models/Sale";
import { ReturnModel } from "@/models/Return";
import { BusinessModel } from "@/models/Business";
import { returnRepo } from "@/repositories/returnRepo";
import { saleRepo, type BusinessConfig } from "@/repositories/saleRepo";
import { toPaise } from "@/lib/money";

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface ReturnableLine {
  lineIndex: number;
  name: string;
  variantLabel: string;
  barcode: string;
  qtyBought: number;
  qtyReturned: number;
  qtyLeft: number;
  refundPerUnit: number; // paise
}
export interface SaleForReturn {
  saleId: string;
  invoiceNo: string;
  date: string;
  customerName: string | null;
  customerPhone: string | null;
  hasCustomer: boolean;
  lines: ReturnableLine[];
}

const IST_MS = 5.5 * 60 * 60 * 1000;

/** Refund per unit = (line net − bill-discount share) / qty — same as returnRepo. */
function perUnit(line: any, sale: any): number {
  const net = (line.taxable ?? 0) + (line.cgst ?? 0) + (line.sgst ?? 0) + (line.igst ?? 0);
  const billDisc = sale.billDiscount ?? 0;
  let share = 0;
  if (billDisc > 0) {
    const totalNet = (sale.items ?? []).reduce((a: number, l: any) => a + (l.taxable ?? 0) + (l.cgst ?? 0) + (l.sgst ?? 0) + (l.igst ?? 0), 0);
    if (totalNet > 0) share = Math.round((billDisc * net) / totalNet);
  }
  return line.qty > 0 ? Math.round(Math.max(0, net - share) / line.qty) : 0;
}

function toSaleForReturn(sale: any): SaleForReturn {
  const lines: ReturnableLine[] = (sale.items ?? []).map((l: any, i: number) => ({
    lineIndex: i,
    name: l.name,
    variantLabel: l.variantLabel ?? "",
    barcode: l.barcode ?? "",
    qtyBought: l.qty,
    qtyReturned: l.returnedQty ?? 0,
    qtyLeft: l.qty - (l.returnedQty ?? 0),
    refundPerUnit: perUnit(l, sale),
  }));
  return {
    saleId: sale._id.toString(),
    invoiceNo: sale.invoiceNo,
    date: new Date(sale.date).toISOString(),
    customerName: sale.customerSnapshot?.name ?? null,
    customerPhone: sale.customerSnapshot?.phone ?? null,
    hasCustomer: !!sale.customerSnapshot?.customerId,
    lines,
  };
}

/** Find a bill to return from — by invoice number, or by scanning an item barcode. */
export async function findSaleForReturn(query: string): Promise<{ ok: true; sale: SaleForReturn } | { ok: false; error: string }> {
  const ctx = await getContext();
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const q = query.trim();
  if (!q) return { ok: false, error: "Scan a barcode or type an invoice number" };

  // 1) Try invoice number (exact, case-insensitive).
  let sale = await SaleModel.findOne({ businessId: bId, status: "ISSUED", invoiceNo: new RegExp(`^${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).lean();

  // 2) Else treat it as a barcode — most recent bill that still has that item to return.
  if (!sale) {
    const candidates = await SaleModel.find({ businessId: bId, status: "ISSUED", "items.barcode": q }).sort({ date: -1 }).limit(20).lean();
    sale = candidates.find((s: any) => (s.items ?? []).some((l: any) => l.barcode === q && l.qty - (l.returnedQty ?? 0) > 0)) ?? candidates[0] ?? null;
  }

  if (!sale) return { ok: false, error: "No bill found for that invoice or barcode" };
  return { ok: true, sale: toSaleForReturn(sale) };
}

export async function createReturn(raw: {
  saleId: string;
  lines: { lineIndex: number; qty: number }[];
  kind?: "RETURN" | "DAMAGE";
  refundMethod: "CASH" | "UPI" | "CARD" | "ADJUST_DUES";
  billedBy?: string;
}): Promise<{ ok: true; returnNo: string; totalRefund: number } | { ok: false; error: string }> {
  const ctx = await getContext();
  requirePerm(ctx, "returns");
  if (!raw?.saleId || !Array.isArray(raw.lines) || raw.lines.every((l) => (l.qty ?? 0) <= 0)) {
    return { ok: false, error: "Select at least one item and quantity to return" };
  }
  try {
    const ret: any = await returnRepo(ctx).create({
      saleId: raw.saleId,
      lines: raw.lines.filter((l) => (l.qty ?? 0) > 0),
      kind: raw.kind ?? "RETURN",
      refundMethod: raw.refundMethod,
      billedBy: raw.billedBy,
    });
    revalidatePath("/returns");
    revalidatePath("/products");
    revalidatePath("/sales");
    revalidatePath("/customers");
    return { ok: true, returnNo: ret.returnNo, totalRefund: ret.totalRefund };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Could not process the return" };
  }
}

async function businessConfig(businessId: string): Promise<BusinessConfig> {
  const b = await BusinessModel.findById(businessId).lean<{ gstType: BusinessConfig["gstType"]; pricesIncludeTax: boolean; stateCode: string | null; allowNegativeStock: boolean }>();
  if (!b) throw new Error("Business not found");
  return { gstType: b.gstType, pricesIncludeTax: b.pricesIncludeTax, stateCode: b.stateCode ?? "", allowNegativeStock: b.allowNegativeStock };
}

/**
 * Exchange: the customer gives items back (resellable → stock) AND takes new
 * products (a new bill). We create the new bill for the new items and an
 * EXCHANGE return for the old ones; the customer pays/receives only the net.
 */
export async function createExchange(raw: {
  saleId: string;
  returnLines: { lineIndex: number; qty: number }[];
  newItems: { productId: string; variantLabel?: string; qty: number; priceRupees: number }[];
  paymentMethod: "CASH" | "UPI" | "CARD";
  billedBy?: string;
}): Promise<{ ok: true; returnNo: string; newInvoiceNo: string; returnValue: number; newTotal: number; net: number } | { ok: false; error: string }> {
  const ctx = await getContext();
  requirePerm(ctx, "returns");
  const returnLines = (raw.returnLines ?? []).filter((l) => (l.qty ?? 0) > 0);
  const newItems = (raw.newItems ?? []).filter((i) => (i.qty ?? 0) > 0);
  if (returnLines.length === 0) return { ok: false, error: "Select which items are being returned" };
  if (newItems.length === 0) return { ok: false, error: "Add the new product(s) the customer is taking" };

  await connectDB();
  try {
    const cfg = await businessConfig(ctx.businessId);
    // carry the original bill's customer so the new bill links to them
    const orig: any = await SaleModel.findOne({ businessId: new mongoose.Types.ObjectId(ctx.businessId), _id: raw.saleId }).lean();
    const customer = orig?.customerSnapshot ? { name: orig.customerSnapshot.name, phone: orig.customerSnapshot.phone, area: orig.customerSnapshot.area } : undefined;

    // 1) New bill for the new items (stock out, full total).
    const newSale: any = await saleRepo(ctx, cfg).create({
      items: newItems.map((i) => ({ productId: i.productId, qty: i.qty, discount: 0, priceOverride: toPaise(i.priceRupees), variantLabel: i.variantLabel })),
      idempotencyKey: crypto.randomUUID(),
      paymentMethod: raw.paymentMethod,
      customer,
      billedBy: raw.billedBy,
    });

    // 2) Exchange return for the old items (stock back, value credited).
    const ret: any = await returnRepo(ctx).create({
      saleId: raw.saleId,
      lines: returnLines,
      kind: "EXCHANGE",
      refundMethod: raw.paymentMethod,
      exchangeSaleId: newSale._id,
      exchangeInvoiceNo: newSale.invoiceNo,
      billedBy: raw.billedBy,
    });

    revalidatePath("/returns");
    revalidatePath("/products");
    revalidatePath("/sales");
    revalidatePath("/customers");
    const returnValue = ret.totalRefund;
    const newTotal = newSale.totals.grandTotal;
    return { ok: true, returnNo: ret.returnNo, newInvoiceNo: newSale.invoiceNo, returnValue, newTotal, net: newTotal - returnValue };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Could not process the exchange" };
  }
}

export interface ReturnListRow {
  id: string;
  returnNo: string;
  date: string;
  kind: string; // RETURN | EXCHANGE | DAMAGE
  originalInvoiceNo: string;
  exchangeInvoiceNo: string;
  customerName: string | null;
  itemCount: number;
  totalRefund: number;
  refundMethod: string;
}

export async function listReturns(limit = 100): Promise<ReturnListRow[]> {
  const ctx = await getContext();
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const rows = await ReturnModel.find({ businessId: bId }).sort({ date: -1 }).limit(limit).lean();
  return rows.map((r: any) => ({
    id: r._id.toString(),
    returnNo: r.returnNo,
    date: new Date(r.date).toISOString(),
    kind: r.kind ?? "RETURN",
    originalInvoiceNo: r.originalInvoiceNo,
    exchangeInvoiceNo: r.exchangeInvoiceNo ?? "",
    customerName: r.customerSnapshot?.name ?? null,
    itemCount: (r.items ?? []).reduce((a: number, i: any) => a + i.qty, 0),
    totalRefund: r.totalRefund ?? 0,
    refundMethod: r.refundMethod ?? "CASH",
  }));
}
