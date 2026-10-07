import { Schema, model, models } from "mongoose";
import { tenantPlugin } from "./plugins/tenant";

const customerSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    phone: { type: String, maxlength: 20, default: "" },
    area: { type: String, maxlength: 120, default: "" },
    balanceDue: { type: Number, default: 0 }, // paise the customer owes (khata)
  },
  { timestamps: true }
);

customerSchema.plugin(tenantPlugin);
customerSchema.index({ businessId: 1, phone: 1 });
customerSchema.index({ businessId: 1, name: 1 });

export const CustomerModel = models.Customer || model("Customer", customerSchema);
