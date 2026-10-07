import { Schema, model, models } from "mongoose";
import { tenantPlugin } from "./plugins/tenant";

const supplierSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    phone: { type: String, maxlength: 20, default: "" },
    area: { type: String, maxlength: 120, default: "" },
    balanceDue: { type: Number, default: 0 }, // paise you owe the supplier
  },
  { timestamps: true }
);

supplierSchema.plugin(tenantPlugin);
supplierSchema.index({ businessId: 1, name: 1 });

export const SupplierModel = models.Supplier || model("Supplier", supplierSchema);
