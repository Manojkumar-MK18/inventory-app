import { Schema, model, models } from "mongoose";
import { tenantPlugin } from "./plugins/tenant";

const brandSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
  },
  { timestamps: true }
);

brandSchema.plugin(tenantPlugin);
brandSchema.index({ businessId: 1, name: 1 }, { unique: true });

export const BrandModel = models.Brand || model("Brand", brandSchema);
