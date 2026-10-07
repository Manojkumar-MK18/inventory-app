import { Schema, model, models } from "mongoose";
import { tenantPlugin } from "./plugins/tenant";

/** One doc per business, per series, per financial year. seq increments atomically. */
const counterSchema = new Schema({
  series: { type: String, required: true }, // e.g. "INV", "CRN"
  fy: { type: String, required: true }, // e.g. "2026-27"
  seq: { type: Number, default: 0 },
});

counterSchema.plugin(tenantPlugin);
counterSchema.index({ businessId: 1, series: 1, fy: 1 }, { unique: true });

export const CounterModel = models.Counter || model("Counter", counterSchema);
