import { Schema, model, models, type InferSchemaType } from "mongoose";
import { tenantPlugin } from "./plugins/tenant";

/** A size/variant of a product (e.g. S/M/L or 32/36/38). Stock is held per variant. */
const variantSchema = new Schema(
  {
    label: { type: String, required: true, maxlength: 20 }, // "S", "M", "32"
    barcode: { type: String, default: "" },
    stock: { type: Number, default: 0 },
    damagedStock: { type: Number, default: 0 }, // damaged pieces of this size (not sellable)
    minStock: { type: Number, default: 0 }, // low-stock alert level for this size
    price: { type: Number, default: null }, // paise; null = use product salePrice
  },
  { _id: false }
);

const productSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 200 },
    sku: { type: String, required: true, maxlength: 50 },
    barcode: { type: String, maxlength: 50 },
    hsn: { type: String, maxlength: 10 },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
    categoryName: { type: String, default: "" }, // denormalised for easy listing/filter
    unit: { type: String, default: "pcs" },
    salePrice: { type: Number, required: true }, // paise
    costPrice: { type: Number, default: 0 }, // paise, weighted average
    taxRate: { type: Number, default: 0 }, // whole percent
    // Standard discount pre-filled on bills. Value is paise when unit "₹", or percent when "%".
    discount: { type: Number, default: 0 },
    discountUnit: { type: String, enum: ["₹", "%"], default: "₹" },
    currentStock: { type: Number, default: 0 }, // total; for variant products = sum of variant stock
    damagedStock: { type: Number, default: 0 }, // total damaged pieces written off (not sellable)
    minStock: { type: Number, default: 0 },
    variants: { type: [variantSchema], default: [] }, // empty = simple product
    sellable: { type: Boolean, default: true }, // false = draft (stocked but not for sale yet)
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.plugin(tenantPlugin);
productSchema.index({ businessId: 1, sku: 1 }, { unique: true });
productSchema.index({ businessId: 1, barcode: 1 });
productSchema.index({ businessId: 1, name: 1 });

export type Product = InferSchemaType<typeof productSchema>;
export const ProductModel = models.Product || model("Product", productSchema);
