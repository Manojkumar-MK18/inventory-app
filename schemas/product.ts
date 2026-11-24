import { z } from "zod";

/** Form input for a product. Prices are entered in RUPEES here and converted to paise server-side. */
export const productFormSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(50),
  barcode: z.string().max(50).optional().or(z.literal("")),
  hsn: z.string().max(10).optional().or(z.literal("")),
  categoryName: z.string().max(80).optional().or(z.literal("")),
  // New product-master fields (spec module 02).
  brandName: z.string().max(80).optional().or(z.literal("")),
  department: z.string().max(20).optional().or(z.literal("")),
  description: z.string().max(1000).optional().or(z.literal("")),
  fabric: z.string().max(60).optional().or(z.literal("")),
  imageUrl: z.string().optional().or(z.literal("")),
  mrpRupees: z.coerce.number().min(0).max(10_000_000).optional(),
  unit: z.string().max(10).default("pcs"),
  salePriceRupees: z.coerce.number().min(0).max(10_000_000),
  taxRate: z.coerce.number().min(0).max(28),
  openingStock: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(0),
  // Optional standard discount. Value meaning depends on discountUnit.
  discountValue: z.coerce.number().min(0).max(10_000_000).default(0),
  discountUnit: z.enum(["₹", "%"]).default("₹"),
  // Optional sizes/variants. When present, stock is tracked per variant.
  // A variant may supply `label` (old form) OR size/color/fit (new wizard) — the
  // server computes `label` from size/color/fit when not given.
  variants: z
    .array(
      z.object({
        label: z.string().max(60).optional().or(z.literal("")),
        origLabel: z.string().max(60).optional().or(z.literal("")), // edit: match existing stock
        size: z.string().max(20).optional().or(z.literal("")),
        color: z.string().max(30).optional().or(z.literal("")),
        fit: z.string().max(20).optional().or(z.literal("")),
        barcode: z.string().max(50).optional().or(z.literal("")),
        openingStock: z.coerce.number().int().min(0).default(0),
        minStock: z.coerce.number().int().min(0).default(0),
        priceRupees: z.coerce.number().min(0).max(10_000_000).optional(),
        mrpRupees: z.coerce.number().min(0).max(10_000_000).optional(),
        costRupees: z.coerce.number().min(0).max(10_000_000).optional(),
        locationCode: z.string().max(20).optional().or(z.literal("")),
      })
    )
    .optional(),
});

export type ProductFormInput = z.infer<typeof productFormSchema>;

/** Editing an existing product: same fields minus opening stock (stock is adjusted separately). */
export const productUpdateSchema = productFormSchema
  .omit({ openingStock: true })
  .extend({ id: z.string().length(24) });

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

/**
 * Adjust stock by a reason-logged movement. One schema for product-level and
 * variant-level (pass `label` for a variant). Reason is mandatory.
 */
export const stockAdjustSchema = z.object({
  id: z.string().length(24),
  label: z.string().max(60).optional().or(z.literal("")), // variant; empty = simple product
  adjustmentType: z.enum(["INCREASE", "DECREASE", "DAMAGE", "LOSS"]),
  quantity: z.coerce.number().int().min(1).max(1_000_000),
  reason: z.string().min(2, "Reason is required").max(200),
  referenceNo: z.string().max(50).optional().or(z.literal("")),
});

export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;

/** Product created from the purchase screen — starts as a draft (not for sale).
 *  Captures the same identity details as the Products menu (category, sizes),
 *  just not the selling price (that's set at "Ready to sell"). */
export const quickProductSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(50),
  unit: z.string().max(10).default("pcs"),
  categoryName: z.string().max(80).optional().or(z.literal("")),
  variants: z.array(z.object({ label: z.string().min(1).max(20) })).optional(),
});

export const setSellableSchema = z.object({
  id: z.string().length(24),
  sellable: z.coerce.boolean(),
});

/** Mark a draft product ready to sell — requires a selling price.
 *  For products with sizes, a price per size can be given in variantPrices. */
export const markReadySchema = z.object({
  id: z.string().length(24),
  salePriceRupees: z.coerce.number().min(0).max(10_000_000),
  mrpRupees: z.coerce.number().min(0).max(10_000_000).optional(),
  taxRate: z.coerce.number().min(0).max(28).default(0),
  variantPrices: z
    .array(z.object({
      label: z.string().min(1).max(60),
      priceRupees: z.coerce.number().min(0).max(10_000_000),
      mrpRupees: z.coerce.number().min(0).max(10_000_000).optional(),
    }))
    .optional(),
});
