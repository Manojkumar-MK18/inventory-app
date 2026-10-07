import { Schema, model, models } from "mongoose";
import { tenantPlugin } from "./plugins/tenant";

const purchaseItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: String, // snapshot
    variantLabel: { type: String, default: "" }, // which size, for variant products (for correct delete-reversal)
    qty: { type: Number, required: true },
    cost: { type: Number, required: true }, // per-unit cost in paise
    taxRate: { type: Number, default: 0 },
  },
  { _id: false }
);

const purchaseSchema = new Schema(
  {
    supplierName: { type: String, default: "" }, // snapshot; full supplier ledger is later
    supplierInvoiceNo: { type: String, default: "" },
    date: { type: Date, default: () => new Date() },
    items: [purchaseItemSchema],
    totalCost: { type: Number, default: 0 }, // paise
    paymentMethod: { type: String, enum: ["PAID", "CREDIT"], default: "PAID" }, // for delete-reversal of dues
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

purchaseSchema.plugin(tenantPlugin);
purchaseSchema.index({ businessId: 1, date: -1 });

export const PurchaseModel = models.Purchase || model("Purchase", purchaseSchema);
