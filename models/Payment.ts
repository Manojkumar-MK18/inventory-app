import { Schema, model, models } from "mongoose";
import { tenantPlugin } from "./plugins/tenant";

export const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "CREDIT"] as const;

const paymentSchema = new Schema(
  {
    refType: { type: String, enum: ["SALE", "PURCHASE", "CUSTOMER_DUE", "SUPPLIER_DUE", "RETURN"], required: true },
    refId: { type: Schema.Types.ObjectId },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    amount: { type: Number, required: true }, // paise
    date: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

paymentSchema.plugin(tenantPlugin);
paymentSchema.index({ businessId: 1, date: -1 });
paymentSchema.index({ businessId: 1, refType: 1, refId: 1 });

export const PaymentModel = models.Payment || model("Payment", paymentSchema);
