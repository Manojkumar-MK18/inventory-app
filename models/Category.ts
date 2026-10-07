import { Schema, model, models } from "mongoose";
import { tenantPlugin } from "./plugins/tenant";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
  },
  { timestamps: true }
);

categorySchema.plugin(tenantPlugin);
categorySchema.index({ businessId: 1, name: 1 }, { unique: true });

export const CategoryModel = models.Category || model("Category", categorySchema);
