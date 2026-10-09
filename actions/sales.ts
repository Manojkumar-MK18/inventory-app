"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/context";
import { requirePerm } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { BusinessModel } from "@/models/Business";
import mongoose from "mongoose";
import { SaleModel } from "@/models/Sale";
import { CustomerModel } from "@/models/Customer";
import { saleRepo, type BusinessConfig } from "@/repositories/saleRepo";
import { createSaleSchema, backdatedSaleSchema } from "@/schemas/sale";

const IST_MS = 5.5 * 60 * 60 * 1000;
/** yyyy-mm-dd (IST) -> a Date at noon IST that day. */
function ymdToNoonIst(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0) - IST_MS);
}

/** Serializable saved-bill shape returned to the POS for the receipt. */
export interface SavedSale {
  invoiceNo: string;
  date: string;
  items: {
    name: string;
    sku: string;
    hsn: string | null;
    qty: number;
    price: number;
    discount: number;
    taxRate: number;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
  }[];
  totals: { taxable: number; cgst: number; sgst: number; igst: number; grandTotal: number };
  roundOff: number;
  billDiscount: number;
  cashReceived: number;
  amountPaid: number;
  dueAmount: number;
  paymentMethod: string;
  customerName: string | null;
  customerPhone: string | null;
  billedBy: string | null;
  status: string;
}

/** Map a Mongoose sale doc to the serializable SavedSale shape. */
function toSavedSale(sale: any): SavedSale {
  return {
    invoiceNo: sale.invoiceNo,
    date: new Date(sale.date).toISOString(),
    items: sale.items.map((i: any) => ({
      name: i.name,
      sku: i.sku ?? "",
      hsn: i.hsn ?? null,
      qty: i.qty,
      price: i.price,
      discount: i.discount,
      taxRate: i.taxRate,
      taxable: i.taxable,
      cgst: i.cgst,
      sgst: i.sgst,
      igst: i.igst,
    })),
    totals: {
      taxable: sale.totals.taxable,
      cgst: sale.totals.cgst,
      sgst: sale.totals.sgst,
      igst: sale.totals.igst,
      grandTotal: sale.totals.grandTotal,
    },
    roundOff: sale.roundOff,
    billDiscount: sale.billDiscount ?? 0,
    cashReceived: sale.cashReceived ?? 0,
    amountPaid: sale.amountPaid ?? (sale.totals?.grandTotal ?? 0),
    dueAmount: sale.dueAmount ?? 0,
    paymentMethod: sale.paymentMethod ?? "CASH",
    customerName: sale.customerSnapshot?.name ?? null,
    customerPhone: sale.customerSnapshot?.phone ?? null,
    billedBy: sale.billedBy || null,
    status: sale.status ?? "ISSUED",
  };
}

export type SaleResult =
  | { ok: true; sale: SavedSale }
  | { ok: false; error: string };

export interface SaleListRow {
  id: string;
  invoiceNo: string;
  date: string;
  customerName: string | null;
  itemCount: number;
  grandTotal: number;
  discount: number; // item discounts + whole-bill discount (paise)
  paymentMethod: string;
  cashReceived: number; // paise handed over (CASH; 0 if not recorded)
  change: number; // paise returned to the customer
  dueAtBilling: number; // paise that were unpaid when the bill was made (frozen)
  dueNow: number; // paise still pending on this bill RIGHT NOW (after later payments)
  billedBy: string | null;
  status: string;
}

/** Recent bills for the Sales page. */
export async function listSales(limit = 100): Promise<SaleListRow[]> {
  const ctx = await getContext();
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const rows = await SaleModel.find({ businessId: bId }).sort({ date: -1 }).limit(limit).lean();

  // A bill's "due at billing" is frozen, but the customer may have paid some back
  // later. Payments aren't tied to one bill, so we settle a customer's OLDEST unpaid
  // bills first (FIFO) to show the real pending amount per bill — this keeps the
  // Sales "Due now" in sync with the customer's live balance.
  const custIds = [...new Set(rows.filter((s: any) => s.customerSnapshot?.customerId && (s.dueAmount ?? 0) > 0)
    .map((s: any) => s.customerSnapshot.customerId.toString()))];
  const customers = custIds.length
    ? await CustomerModel.find({ businessId: bId, _id: { $in: custIds } }).lean()
    : [];
  const balanceByCust = new Map<string, number>(customers.map((c: any) => [c._id.toString(), c.balanceDue ?? 0]));

  // Per customer: distribute the amount already paid back across their bills, oldest first.
  const dueNowBySale = new Map<string, number>();
  for (const cid of custIds) {
    const theirBills = rows
      .filter((s: any) => s.customerSnapshot?.customerId?.toString() === cid && (s.dueAmount ?? 0) > 0)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()); // oldest first
    const originalDue = theirBills.reduce((a: number, s: any) => a + (s.dueAmount ?? 0), 0);
    const currentBalance = balanceByCust.get(cid) ?? originalDue;
    let paidBack = Math.max(0, originalDue - currentBalance); // amount collected since
    for (const s of theirBills as any[]) {
      const pay = Math.min(paidBack, s.dueAmount ?? 0);
      dueNowBySale.set(s._id.toString(), (s.dueAmount ?? 0) - pay);
      paidBack -= pay;
    }
  }

  return rows.map((s: any) => {
    const itemDisc = (s.items ?? []).reduce((a: number, i: any) => a + (i.discount || 0), 0);
    const grandTotal = s.totals?.grandTotal ?? 0;
    const cashReceived = s.cashReceived ?? 0;
    const dueAtBilling = s.dueAmount ?? 0;
    return {
      id: s._id.toString(),
      invoiceNo: s.invoiceNo,
      date: new Date(s.date).toISOString(),
      customerName: s.customerSnapshot?.name ?? null,
      itemCount: s.items?.length ?? 0,
      grandTotal,
      discount: itemDisc + (s.billDiscount ?? 0),
      paymentMethod: s.paymentMethod ?? "CASH",
      cashReceived,
      change: cashReceived > grandTotal ? cashReceived - grandTotal : 0,
      dueAtBilling,
      dueNow: dueNowBySale.has(s._id.toString()) ? dueNowBySale.get(s._id.toString())! : dueAtBilling,
      billedBy: s.billedBy || null,
      status: s.status,
    };
  });
}

async function businessConfig(businessId: string): Promise<BusinessConfig> {
  await connectDB();
  const b = await BusinessModel.findById(businessId).lean<{
    gstType: BusinessConfig["gstType"];
    pricesIncludeTax: boolean;
    stateCode: string | null;
    allowNegativeStock: boolean;
  }>();
  if (!b) throw new Error("Business not found");
  return {
    gstType: b.gstType,
    pricesIncludeTax: b.pricesIncludeTax,
    stateCode: b.stateCode ?? "",
    allowNegativeStock: b.allowNegativeStock,
  };
}

export async function createSale(raw: unknown): Promise<SaleResult> {
  const ctx = await getContext();
  requirePerm(ctx, "pos");

  const parsed = createSaleSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid sale" };
  }

  try {
    const cfg = await businessConfig(ctx.businessId);
    const sale: any = await saleRepo(ctx, cfg).create({ ...parsed.data, billedBy: parsed.data.billedBy });

    revalidatePath("/products");
    revalidatePath("/pos");
    revalidatePath("/sales");
    revalidatePath("/customers");

    return { ok: true, sale: toSavedSale(sale) };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Could not save the bill" };
  }
}

/** Record a past/forgotten bill with a chosen date and auto or manual invoice number. */
export async function createBackdatedSale(raw: unknown): Promise<SaleResult> {
  const ctx = await getContext();
  requirePerm(ctx, "sales");

  const parsed = backdatedSaleSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid bill" };
  }
  const d = parsed.data;

  try {
    const cfg = await businessConfig(ctx.businessId);
    const sale: any = await saleRepo(ctx, cfg).create({
      items: d.items,
      idempotencyKey: d.idempotencyKey,
      paymentMethod: d.paymentMethod,
      customer: d.customer,
      billedBy: d.billedBy,
      billDiscount: d.billDiscount,
      cashReceived: d.cashReceived,
      date: ymdToNoonIst(d.dateYmd),
      invoiceNoOverride: d.invoiceMode === "MANUAL" ? d.invoiceNo!.trim() : undefined,
    });

    revalidatePath("/sales");
    revalidatePath("/products");
    revalidatePath("/customers");
    return { ok: true, sale: toSavedSale(sale) };
  } catch (e: any) {
    if (e?.code === 11000) return { ok: false, error: "That invoice number already exists — use a different one" };
    return { ok: false, error: e?.message ?? "Could not save the bill" };
  }
}

/** Fetch one saved bill for viewing / reprinting. */
export async function getSale(id: string): Promise<SavedSale | null> {
  const ctx = await getContext();
  await connectDB();
  const sale = await SaleModel.findOne({
    businessId: new mongoose.Types.ObjectId(ctx.businessId),
    _id: id,
  }).lean();
  return sale ? toSavedSale(sale) : null;
}
