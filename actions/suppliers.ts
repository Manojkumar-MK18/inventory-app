"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { getContext } from "@/lib/context";
import { requireRole } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { SupplierModel } from "@/models/Supplier";
import { PaymentModel } from "@/models/Payment";
import { PurchaseModel } from "@/models/Purchase";
import { toPaise } from "@/lib/money";
import { partyFormSchema, settleDueSchema, partyUpdateSchema } from "@/schemas/party";
import type { PartyHistory } from "@/lib/party-types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface SupplierDTO {
  id: string;
  name: string;
  phone: string;
  area: string;
  balanceDue: number;
}

export async function listSuppliers(): Promise<SupplierDTO[]> {
  const ctx = await getContext();
  await connectDB();
  const rows = await SupplierModel.find({ businessId: new mongoose.Types.ObjectId(ctx.businessId) })
    .sort({ balanceDue: -1, name: 1 })
    .lean();
  return rows.map((s: any) => ({
    id: s._id.toString(),
    name: s.name,
    phone: s.phone ?? "",
    area: s.area ?? "",
    balanceDue: s.balanceDue ?? 0,
  }));
}

export async function createSupplier(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requireRole(ctx, ["OWNER", "MANAGER"]);
  const parsed = partyFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the details" };

  await connectDB();
  await SupplierModel.create({
    businessId: new mongoose.Types.ObjectId(ctx.businessId),
    name: parsed.data.name,
    phone: parsed.data.phone || "",
    area: parsed.data.area || "",
  });
  revalidatePath("/suppliers");
  return { ok: true };
}

/** Pay a supplier against what you owe: reduce balance + record payment. */
export async function paySupplier(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requireRole(ctx, ["OWNER", "MANAGER"]);
  const parsed = settleDueSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid amount" };
  const { id, amountRupees, method } = parsed.data;
  const amount = toPaise(amountRupees);

  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const supplier = await SupplierModel.findOne({ businessId: bId, _id: id });
  if (!supplier) return { ok: false, error: "Supplier not found" };
  if (amount > supplier.balanceDue) return { ok: false, error: "Amount is more than the due balance" };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await SupplierModel.updateOne({ businessId: bId, _id: id }, { $inc: { balanceDue: -amount } }, { session });
      await PaymentModel.create(
        [{ businessId: bId, refType: "SUPPLIER_DUE", refId: supplier._id, method, amount }],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
  revalidatePath("/suppliers");
  return { ok: true };
}

export async function updateSupplier(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requireRole(ctx, ["OWNER", "MANAGER"]);
  const parsed = partyUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the details" };
  const d = parsed.data;
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const updated = await SupplierModel.findOneAndUpdate(
    { businessId: bId, _id: d.id },
    { $set: { name: d.name, phone: d.phone || "", area: d.area || "" } }
  );
  if (!updated) return { ok: false, error: "Supplier not found" };
  revalidatePath("/suppliers");
  return { ok: true };
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  const ctx = await getContext();
  requireRole(ctx, ["OWNER", "MANAGER"]);
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const s = await SupplierModel.findOne({ businessId: bId, _id: id });
  if (!s) return { ok: false, error: "Supplier not found" };
  if (s.balanceDue > 0) return { ok: false, error: "Pay the outstanding dues before deleting" };
  await SupplierModel.deleteOne({ businessId: bId, _id: id });
  revalidatePath("/suppliers");
  return { ok: true };
}

export async function supplierHistory(id: string): Promise<PartyHistory> {
  const ctx = await getContext();
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const s: any = await SupplierModel.findOne({ businessId: bId, _id: id }).lean();
  const purchases = await PurchaseModel.find({ businessId: bId, supplierName: s?.name ?? "___none___" }).sort({ date: -1 }).lean();
  const payments = await PaymentModel.find({ businessId: bId, refType: "SUPPLIER_DUE", refId: new mongoose.Types.ObjectId(id) }).sort({ date: -1 }).lean();
  return {
    name: s?.name ?? "", phone: s?.phone ?? "", area: s?.area ?? "", balanceDue: s?.balanceDue ?? 0,
    entriesLabel: "Purchases",
    entries: purchases.map((p: any) => ({ date: new Date(p.date).toISOString(), title: p.supplierInvoiceNo || "Purchase", detail: `${p.items?.length ?? 0} items`, amount: p.totalCost ?? 0 })),
    payments: payments.map((p: any) => ({ date: new Date(p.date).toISOString(), method: p.method, amount: p.amount })),
  };
}
