"use server";

import mongoose from "mongoose";
import { getContext } from "@/lib/context";
import { connectDB } from "@/lib/db";
import { CategoryModel } from "@/models/Category";

export async function listCategories(): Promise<string[]> {
  const ctx = await getContext();
  await connectDB();
  const rows = await CategoryModel.find({ businessId: new mongoose.Types.ObjectId(ctx.businessId) })
    .sort({ name: 1 })
    .lean();
  return rows.map((c: any) => c.name);
}
