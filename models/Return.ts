import { Schema, model, models, type InferSchemaType } from "mongoose";
import { tenantPlugin } from "./plugins/tenant";

/** One returned line — a snapshot, linked back to the original sale line. */
const returnItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: String,
    variantLabel: { type: String, default: "" },
    barcode: { type: String, default: "" },
    qty: { type: Number, required: true }, // how many were returned
    refundPerUnit: { type: Number, required: true }, // paise actually paid per unit (price − discount share)
    refundTotal: { type: Number, required: true }, // paise = refundPerUnit × qty
    costAtSale: { type: Number, default: 0 }, // paise, so profit reports can reverse COGS
  },
  { _id: false }
);

/**
 * A return / credit note. It NEVER edits the original sale — it is a new,
 * linked record. Reports treat returns as money going out and stock coming in.
 */
const returnSchema = new Schema(
  {
    returnNo: { type: String, required: true }, // e.g. RET/26-27/000004
    date: { type: Date, default: () => new Date() },
    // RETURN = money back, item resellable; EXCHANGE = item resellable + new bill;
    // DAMAGE = item written off (NOT back in sellable stock).
    kind: { type: String, enum: ["RETURN", "EXCHANGE", "DAMAGE"], default: "RETURN" },
    exchangeSaleId: { type: Schema.Types.ObjectId, ref: "Sale" }, // the new bill, for exchanges
    exchangeInvoiceNo: { type: String, default: "" },
    originalSaleId: { type: Schema.Types.ObjectId, ref: "Sale", required: true },
    originalInvoiceNo: { type: String, required: true },
    customerSnapshot: {
      customerId: Schema.Types.ObjectId,
      name: String,
      phone: String,
    },
    items: [returnItemSchema],
    totalRefund: { type: Number, required: true }, // paise
    refundMethod: { type: String, enum: ["CASH", "UPI", "CARD", "ADJUST_DUES"], default: "CASH" },
    note: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    billedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

returnSchema.plugin(tenantPlugin);
returnSchema.index({ businessId: 1, returnNo: 1 }, { unique: true });
returnSchema.index({ businessId: 1, date: -1 });
returnSchema.index({ businessId: 1, originalSaleId: 1 });

export type ReturnDoc = InferSchemaType<typeof returnSchema>;
export const ReturnModel = models.Return || model("Return", returnSchema);
