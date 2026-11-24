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
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", default: null },
    supplierName: { type: String, default: "" }, // snapshot
    supplierInvoiceNo: { type: String, default: "" },
    date: { type: Date, default: () => new Date() }, // received date (goods in)
    invoiceDate: { type: Date, default: null }, // supplier's bill date
    items: [purchaseItemSchema],
    subtotal: { type: Number, default: 0 }, // paise, Σ(qty×cost)
    otherCharges: { type: Number, default: 0 }, // paise, freight/landed
    discountAmount: { type: Number, default: 0 }, // paise
    totalCost: { type: Number, default: 0 }, // paise, grand total (subtotal + charges − discount)
    // Payment
    paymentStatus: { type: String, enum: ["UNPAID", "PARTIAL", "PAID"], default: "PAID" },
    amountPaid: { type: Number, default: 0 }, // paise
    dueAmount: { type: Number, default: 0 }, // paise still owed (for delete-reversal)
    paymentMode: { type: String, enum: ["CASH", "UPI", "BANK", "CHEQUE"], default: "CASH" },
    referenceNo: { type: String, default: "" },
    notes: { type: String, default: "" },
    paymentMethod: { type: String, enum: ["PAID", "CREDIT"], default: "PAID" }, // legacy, kept for old rows
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

purchaseSchema.plugin(tenantPlugin);
purchaseSchema.index({ businessId: 1, date: -1 });

export const PurchaseModel = models.Purchase || model("Purchase", purchaseSchema);
