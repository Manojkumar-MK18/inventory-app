import { Schema, model, models } from "mongoose";
import { tenantPlugin } from "./plugins/tenant";

export const MOVEMENT_TYPES = [
  "PURCHASE",
  "SALE",
  "SALE_RETURN",
  "PURCHASE_RETURN",
  "DAMAGE",
  "ADJUSTMENT",
  "OPENING",
] as const;

/** Every stock change is a row here. products.currentStock is the cached total. */
const stockMovementSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  variantLabel: { type: String, default: "" }, // which size, for variant products
  type: { type: String, enum: MOVEMENT_TYPES, required: true },
  qty: { type: Number, required: true }, // signed: +in, -out
  refType: { type: String }, // "SALE" | "PURCHASE" | ...
  refId: { type: Schema.Types.ObjectId },
  date: { type: Date, default: () => new Date() },
});

stockMovementSchema.plugin(tenantPlugin);
stockMovementSchema.index({ businessId: 1, productId: 1, date: -1 });

export const StockMovementModel =
  models.StockMovement || model("StockMovement", stockMovementSchema);
