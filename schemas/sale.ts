import { z } from "zod";

export const cartItemSchema = z.object({
  productId: z.string().length(24),
  qty: z.coerce.number().int().positive().max(100000),
  discount: z.coerce.number().int().min(0).default(0), // per-unit paise
  // Optional per-line price override (paise). Staff can renegotiate price at billing.
  priceOverride: z.coerce.number().int().min(0).max(1_000_000_00).optional(),
  variantLabel: z.string().max(20).optional(),
});

export const createSaleSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Add at least one item"),
  idempotencyKey: z.string().uuid(),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "CREDIT"]).default("CASH"),
  customer: z
    .object({
      name: z.string().max(120).optional().or(z.literal("")),
      phone: z.string().max(20).optional().or(z.literal("")),
      area: z.string().max(120).optional().or(z.literal("")),
    })
    .optional(),
  billedBy: z.string().max(80).optional().or(z.literal("")),
  billDiscount: z.coerce.number().int().min(0).default(0), // paise, off the final total
  cashReceived: z.coerce.number().int().min(0).default(0), // paise handed over (CASH)
});

export type CreateSaleFormInput = z.infer<typeof createSaleSchema>;

/** A past/forgotten bill, entered later, with a chosen date and auto/manual invoice no. */
export const backdatedSaleSchema = z
  .object({
    items: z.array(cartItemSchema).min(1, "Add at least one item"),
    idempotencyKey: z.string().uuid(),
    paymentMethod: z.enum(["CASH", "UPI", "CARD", "CREDIT"]).default("CASH"),
    customer: z
      .object({
        name: z.string().max(120).optional().or(z.literal("")),
        phone: z.string().max(20).optional().or(z.literal("")),
        area: z.string().max(120).optional().or(z.literal("")),
      })
      .optional(),
    dateYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    invoiceMode: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
    invoiceNo: z.string().max(40).optional().or(z.literal("")),
    billedBy: z.string().max(80).optional().or(z.literal("")),
    billDiscount: z.coerce.number().int().min(0).default(0),
    cashReceived: z.coerce.number().int().min(0).default(0),
  })
  .refine((d) => d.invoiceMode !== "MANUAL" || !!d.invoiceNo?.trim(), {
    message: "Enter the invoice number",
    path: ["invoiceNo"],
  });
