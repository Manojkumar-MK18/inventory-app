import { Schema, model, models } from "mongoose";

/**
 * A business IS the tenant root, so it is not itself tenant-scoped.
 * Config fields here drive the tax engine and invoice output.
 */
const businessSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 200 },
    gstin: { type: String, maxlength: 15, default: null },
    gstType: {
      type: String,
      enum: ["REGULAR", "COMPOSITION", "UNREGISTERED"],
      default: "UNREGISTERED",
    },
    stateCode: { type: String, maxlength: 2, default: null }, // first 2 digits of GSTIN
    address: { type: String, maxlength: 500, default: "" },
    phone: { type: String, maxlength: 20, default: "" },
    instagram: { type: String, maxlength: 200, default: "" }, // full profile URL
    mapsUrl: { type: String, maxlength: 400, default: "" }, // Google Maps share link
    logo: { type: String, default: null }, // base64, <= 100KB, no SVG

    // Behaviour flags
    pricesIncludeTax: { type: Boolean, default: true },
    allowNegativeStock: { type: Boolean, default: false },
    // Weekly off day: -1 = none, 0 = Sunday … 6 = Saturday. Excluded from "Leave".
    weeklyOff: { type: Number, default: -1 },

    invoiceSettings: {
      prefix: { type: String, default: "INV" },
      terms: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

export const BusinessModel = models.Business || model("Business", businessSchema);
