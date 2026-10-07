import { z } from "zod";

/** Form input for a product. Prices are entered in RUPEES here and converted to paise server-side. */
export const productFormSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(50),
  barcode: z.string().max(50).optional().or(z.literal("")),
  hsn: z.string().max(10).optional().or(z.literal("")),
  categoryName: z.string().max(80).optional().or(z.literal("")),
  unit: z.string().max(10).default("pcs"),
  salePriceRupees: z.coerce.number().min(0).max(10_000_000),
  taxRate: z.coerce.number().min(0).max(28),
  openingStock: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(0),
  // Optional standard discount. Value meaning depends on discountUnit.
  discountValue: z.coerce.number().min(0).max(10_000_000).default(0),
  discountUnit: z.enum(["₹", "%"]).default("₹"),
  // Optional sizes/variants. When present, stock is tracked per variant.
  variants: z
    .array(
      z.object({
        label: z.string().min(1).max(20),
        barcode: z.string().max(50).optional().or(z.literal("")),
        openingStock: z.coerce.number().int().min(0).default(0),
        minStock: z.coerce.number().int().min(0).default(0),
        priceRupees: z.coerce.number().min(0).max(10_000_000).optional(),
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

/** Adjust stock to an exact new count (creates an ADJUSTMENT movement for the difference). */
export const stockAdjustSchema = z.object({
  id: z.string().length(24),
  newCount: z.coerce.number().int().min(0).max(10_000_000),
  note: z.string().max(200).optional().or(z.literal("")),
});

export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;

/** Adjust a single variant's stock to an exact count. */
export const variantStockAdjustSchema = z.object({
  id: z.string().length(24),
  label: z.string().min(1).max(20),
  newCount: z.coerce.number().int().min(0).max(10_000_000),
});

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
  taxRate: z.coerce.number().min(0).max(28).default(0),
  variantPrices: z
    .array(z.object({ label: z.string().min(1).max(20), priceRupees: z.coerce.number().min(0).max(10_000_000) }))
    .optional(),
});
