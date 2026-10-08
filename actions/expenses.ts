"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { z } from "zod";
import { getContext } from "@/lib/context";
import { requirePerm } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { ExpenseModel } from "@/models/Expense";
import { toPaise } from "@/lib/money";

export type ActionResult = { ok: true } | { ok: false; error: string };

const expenseFormSchema = z.object({
  category: z.string().min(1).max(80),
  amountRupees: z.coerce.number().positive().max(10_000_000),
  note: z.string().max(200).optional().or(z.literal("")),
});

export interface ExpenseDTO {
  id: string;
  category: string;
  amount: number;
  date: string;
  note: string;
}

export async function listExpenses(limit = 200): Promise<ExpenseDTO[]> {
  const ctx = await getContext();
  await connectDB();
  const rows = await ExpenseModel.find({ businessId: new mongoose.Types.ObjectId(ctx.businessId) })
    .sort({ date: -1 })
    .limit(limit)
    .lean();
  return rows.map((e: any) => ({
    id: e._id.toString(),
    category: e.category,
    amount: e.amount,
    date: new Date(e.date).toISOString(),
    note: e.note ?? "",
  }));
}

export async function createExpense(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requirePerm(ctx, "expenses");
  const parsed = expenseFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the expense details" };

  await connectDB();
  await ExpenseModel.create({
    businessId: new mongoose.Types.ObjectId(ctx.businessId),
    category: parsed.data.category,
    amount: toPaise(parsed.data.amountRupees),
    note: parsed.data.note || "",
    createdBy: ctx.userId,
  });
  revalidatePath("/expenses");
  return { ok: true };
}
