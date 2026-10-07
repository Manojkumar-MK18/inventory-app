"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { getContext } from "@/lib/context";
import { requireRole } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { CustomerModel } from "@/models/Customer";
import { PaymentModel } from "@/models/Payment";
import { SaleModel } from "@/models/Sale";
import { toPaise } from "@/lib/money";
import { partyFormSchema, settleDueSchema, partyUpdateSchema } from "@/schemas/party";
import type { PartyHistory } from "@/lib/party-types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface CustomerDTO {
  id: string;
  name: string;
  phone: string;
  area: string;
  balanceDue: number; // paise
}

export async function listCustomers(): Promise<CustomerDTO[]> {
  const ctx = await getContext();
  await connectDB();
  const rows = await CustomerModel.find({ businessId: new mongoose.Types.ObjectId(ctx.businessId) })
    .sort({ balanceDue: -1, name: 1 })
    .lean();
  return rows.map((c: any) => ({
    id: c._id.toString(),
    name: c.name,
    phone: c.phone ?? "",
    area: c.area ?? "",
    balanceDue: c.balanceDue ?? 0,
  }));
}

export async function createCustomer(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requireRole(ctx, ["OWNER", "MANAGER", "CASHIER"]);
  const parsed = partyFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the details" };

  await connectDB();
  await CustomerModel.create({
    businessId: new mongoose.Types.ObjectId(ctx.businessId),
    name: parsed.data.name,
    phone: parsed.data.phone || "",
    area: parsed.data.area || "",
  });
  revalidatePath("/customers");
  return { ok: true };
}

/** Receive a payment against a customer's khata: reduce balance + record payment. */
export async function receiveCustomerPayment(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requireRole(ctx, ["OWNER", "MANAGER", "CASHIER"]);
  const parsed = settleDueSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid amount" };
  const { id, amountRupees, method } = parsed.data;
  const amount = toPaise(amountRupees);

  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const customer = await CustomerModel.findOne({ businessId: bId, _id: id });
  if (!customer) return { ok: false, error: "Customer not found" };
  if (amount > customer.balanceDue) return { ok: false, error: "Amount is more than the due balance" };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await CustomerModel.updateOne({ businessId: bId, _id: id }, { $inc: { balanceDue: -amount } }, { session });
      await PaymentModel.create(
        [{ businessId: bId, refType: "CUSTOMER_DUE", refId: customer._id, method, amount }],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
  revalidatePath("/customers");
  return { ok: true };
}

export async function updateCustomer(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requireRole(ctx, ["OWNER", "MANAGER"]);
  const parsed = partyUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the details" };
  const d = parsed.data;
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const updated = await CustomerModel.findOneAndUpdate(
    { businessId: bId, _id: d.id },
    { $set: { name: d.name, phone: d.phone || "", area: d.area || "" } }
  );
  if (!updated) return { ok: false, error: "Customer not found" };
  revalidatePath("/customers");
  return { ok: true };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const ctx = await getContext();
  requireRole(ctx, ["OWNER", "MANAGER"]);
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const c = await CustomerModel.findOne({ businessId: bId, _id: id });
  if (!c) return { ok: false, error: "Customer not found" };
  if (c.balanceDue > 0) return { ok: false, error: "Collect the outstanding khata before deleting" };
  await CustomerModel.deleteOne({ businessId: bId, _id: id });
  revalidatePath("/customers");
  return { ok: true };
}

export async function customerHistory(id: string): Promise<PartyHistory> {
  const ctx = await getContext();
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const c: any = await CustomerModel.findOne({ businessId: bId, _id: id }).lean();
  const sales = await SaleModel.find({ businessId: bId, "customerSnapshot.customerId": new mongoose.Types.ObjectId(id) }).sort({ date: -1 }).lean();
  const payments = await PaymentModel.find({ businessId: bId, refType: "CUSTOMER_DUE", refId: new mongoose.Types.ObjectId(id) }).sort({ date: -1 }).lean();
  return {
    name: c?.name ?? "", phone: c?.phone ?? "", area: c?.area ?? "", balanceDue: c?.balanceDue ?? 0,
    entriesLabel: "Bills",
    entries: sales.map((s: any) => {
      const pay = s.paymentMethod === "CREDIT" ? "Khata" : s.paymentMethod ?? "CASH";
      const due = s.dueAmount ?? 0;
      const detail = `${s.items?.length ?? 0} item${(s.items?.length ?? 0) === 1 ? "" : "s"} · ${pay}` + (due > 0 ? ` · due ₹${(due / 100).toFixed(2)}` : "");
      return { date: new Date(s.date).toISOString(), title: s.invoiceNo, detail, amount: s.totals?.grandTotal ?? 0 };
    }),
    payments: payments.map((p: any) => ({ date: new Date(p.date).toISOString(), method: p.method, amount: p.amount })),
  };
}
