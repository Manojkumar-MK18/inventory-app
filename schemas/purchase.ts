import { z } from "zod";

export const purchaseLineSchema = z.object({
  productId: z.string().length(24),
  qty: z.coerce.number().int().positive().max(1_000_000),
  costRupees: z.coerce.number().min(0).max(10_000_000),
  variantLabel: z.string().max(60).optional(),
});

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));

export const createPurchaseSchema = z.object({
  supplierName: z.string().max(200).optional().or(z.literal("")),
  supplierInvoiceNo: z.string().max(50).optional().or(z.literal("")),
  invoiceDateYmd: ymd,
  dateYmd: ymd, // received date; defaults to today
  otherChargesRupees: z.coerce.number().min(0).max(10_000_000).default(0),
  discountRupees: z.coerce.number().min(0).max(10_000_000).default(0),
  // Payment
  paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID"]).default("PAID"),
  amountPaidRupees: z.coerce.number().min(0).max(10_000_000).default(0),
  paymentMode: z.enum(["CASH", "UPI", "BANK", "CHEQUE"]).default("CASH"),
  referenceNo: z.string().max(50).optional().or(z.literal("")),
  notes: z.string().max(300).optional().or(z.literal("")),
  items: z.array(purchaseLineSchema).min(1, "Add at least one item"),
});

export const editPurchaseSchema = createPurchaseSchema.extend({ id: z.string().length(24) });

export type CreatePurchaseFormInput = z.infer<typeof createPurchaseSchema>;
