import { Schema, model, models } from "mongoose";
import { tenantPlugin } from "./plugins/tenant";

const expenseSchema = new Schema(
  {
    category: { type: String, required: true, maxlength: 80 },
    amount: { type: Number, required: true }, // paise
    date: { type: Date, default: () => new Date() },
    note: { type: String, maxlength: 200, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

expenseSchema.plugin(tenantPlugin);
expenseSchema.index({ businessId: 1, date: -1 });

export const ExpenseModel = models.Expense || model("Expense", expenseSchema);
