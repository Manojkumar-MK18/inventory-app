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
  legalName: string;
  gstin: string;
  gstType: "REGULAR" | "COMPOSITION" | "UNREGISTERED";
  stateCode: string;
  address: string;
  phone: string;
  email: string;
  instagram: string;
  mapsUrl: string;
  lat: number | null;
  lng: number | null;
  pricesIncludeTax: boolean;
  allowNegativeStock: boolean;
  lowStockAlertEnabled: boolean;
  weeklyOff: number;
  currency: string;
  fyStartMonth: number;
  returnWindowDays: number;
  discountApprovalLimit: number;
  invoicePrefix: string;
  invoiceTerms: string;
}

// All optional → each settings card can save just its own fields (partial update).
const settingsSchema = z
  .object({
    name: z.string().min(2).max(200),
    legalName: z.string().max(200),
    gstType: z.enum(["REGULAR", "COMPOSITION", "UNREGISTERED"]),
    gstin: z.string().max(15).or(z.literal("")),
    stateCode: z.string().max(2).or(z.literal("")),
    address: z.string().max(500).or(z.literal("")),
    phone: z.string().max(20).or(z.literal("")),
    email: z.string().max(254).or(z.literal("")),
    instagram: z.string().max(200).or(z.literal("")),
    mapsUrl: z.string().max(400).or(z.literal("")),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    pricesIncludeTax: z.coerce.boolean(),
    allowNegativeStock: z.coerce.boolean(),
    lowStockAlertEnabled: z.coerce.boolean(),
    weeklyOff: z.coerce.number().int().min(-1).max(6),
    currency: z.string().max(8),
    fyStartMonth: z.coerce.number().int().min(1).max(12),
    returnWindowDays: z.coerce.number().int().min(0).max(365),
    discountApprovalLimit: z.coerce.number().min(0).max(100),
    invoicePrefix: z.string().max(20),
    invoiceTerms: z.string().max(500),
  })
  .partial();

export async function getBusiness(): Promise<BusinessDTO> {
  const ctx = await getContext();
  await connectDB();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = await BusinessModel.findById(ctx.businessId).lean();
  return {
    name: b?.name ?? "",
    legalName: b?.legalName ?? "",
    gstin: b?.gstin ?? "",
    gstType: b?.gstType ?? "UNREGISTERED",
    stateCode: b?.stateCode ?? "",
    address: b?.address ?? "",
    phone: b?.phone ?? "",
    email: b?.email ?? "",
    instagram: b?.instagram ?? "",
    mapsUrl: b?.mapsUrl ?? "",
    lat: b?.lat ?? null,
    lng: b?.lng ?? null,
    pricesIncludeTax: b?.pricesIncludeTax ?? true,
    allowNegativeStock: b?.allowNegativeStock ?? false,
    lowStockAlertEnabled: b?.lowStockAlertEnabled ?? true,
    weeklyOff: b?.weeklyOff ?? -1,
    currency: b?.currency ?? "INR",
    fyStartMonth: b?.fyStartMonth ?? 4,
    returnWindowDays: b?.returnWindowDays ?? 7,
    discountApprovalLimit: b?.discountApprovalLimit ?? 0,
    invoicePrefix: b?.invoiceSettings?.prefix ?? "INV",
    invoiceTerms: b?.invoiceSettings?.terms ?? "",
  };
}

export async function updateBusiness(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requireRole(ctx, ["OWNER"]); // only the owner changes shop settings
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the details" };
  const d = parsed.data;

  // Build $set from only the fields that were actually sent (partial save).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set: Record<string, any> = {};
  const simple = [
    "name", "legalName", "address", "phone", "email", "instagram", "mapsUrl",
    "lat", "lng", "pricesIncludeTax", "allowNegativeStock", "lowStockAlertEnabled",
    "weeklyOff", "currency", "fyStartMonth", "returnWindowDays", "discountApprovalLimit",
    "gstType",
  ] as const;
  for (const k of simple) if (d[k] !== undefined) set[k] = d[k];

  if (d.gstin !== undefined) {
    set.gstin = d.gstin || null;
    // Keep stateCode in sync with GSTIN when it is a full number.
    if (d.gstin && d.gstin.length === 15) set.stateCode = d.gstin.slice(0, 2);
  }
  if (d.stateCode !== undefined && set.stateCode === undefined) {
    set.stateCode = d.stateCode || null;
  }
  if (d.invoicePrefix !== undefined) set["invoiceSettings.prefix"] = d.invoicePrefix;
  if (d.invoiceTerms !== undefined) set["invoiceSettings.terms"] = d.invoiceTerms;

  if (Object.keys(set).length === 0) return { ok: true };

  await connectDB();
  await BusinessModel.updateOne(
    { _id: new mongoose.Types.ObjectId(ctx.businessId) },
    { $set: set }
  );
  revalidatePath("/settings");
  revalidatePath("/pos");
  return { ok: true };
}
