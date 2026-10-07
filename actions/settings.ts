"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { z } from "zod";
import { getContext } from "@/lib/context";
import { requireRole } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { BusinessModel } from "@/models/Business";

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface BusinessDTO {
  name: string;
  gstin: string;
  gstType: "REGULAR" | "COMPOSITION" | "UNREGISTERED";
  stateCode: string;
  address: string;
  phone: string;
  instagram: string;
  mapsUrl: string;
  pricesIncludeTax: boolean;
  allowNegativeStock: boolean;
  weeklyOff: number;
}

const settingsSchema = z.object({
  name: z.string().min(2).max(200),
  gstType: z.enum(["REGULAR", "COMPOSITION", "UNREGISTERED"]),
  gstin: z.string().max(15).optional().or(z.literal("")),
  stateCode: z.string().max(2).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  instagram: z.string().max(200).optional().or(z.literal("")),
  mapsUrl: z.string().max(400).optional().or(z.literal("")),
  pricesIncludeTax: z.coerce.boolean(),
  allowNegativeStock: z.coerce.boolean(),
  weeklyOff: z.coerce.number().int().min(-1).max(6),
});

export async function getBusiness(): Promise<BusinessDTO> {
  const ctx = await getContext();
  await connectDB();
  const b: any = await BusinessModel.findById(ctx.businessId).lean();
  return {
    name: b?.name ?? "",
    gstin: b?.gstin ?? "",
    gstType: b?.gstType ?? "UNREGISTERED",
    stateCode: b?.stateCode ?? "",
    address: b?.address ?? "",
    phone: b?.phone ?? "",
    instagram: b?.instagram ?? "",
    mapsUrl: b?.mapsUrl ?? "",
    pricesIncludeTax: b?.pricesIncludeTax ?? true,
    allowNegativeStock: b?.allowNegativeStock ?? false,
    weeklyOff: b?.weeklyOff ?? -1,
  };
}

export async function updateBusiness(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requireRole(ctx, ["OWNER"]); // only the owner changes shop settings
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the details" };
  const d = parsed.data;

  const stateCode = d.gstin && d.gstin.length === 15 ? d.gstin.slice(0, 2) : d.stateCode || null;

  await connectDB();
  await BusinessModel.updateOne(
    { _id: new mongoose.Types.ObjectId(ctx.businessId) },
    {
      $set: {
        name: d.name,
        gstType: d.gstType,
        gstin: d.gstin || null,
        stateCode,
        address: d.address || "",
        phone: d.phone || "",
        instagram: d.instagram || "",
        mapsUrl: d.mapsUrl || "",
        pricesIncludeTax: d.pricesIncludeTax,
        allowNegativeStock: d.allowNegativeStock,
        weeklyOff: d.weeklyOff,
      },
    }
  );
  revalidatePath("/settings");
  revalidatePath("/pos");
  return { ok: true };
}
