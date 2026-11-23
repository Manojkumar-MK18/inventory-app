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
    lat: { type: Number, default: null }, // shop location (optional, from map picker)
    lng: { type: Number, default: null },
    logo: { type: String, default: null }, // base64, <= 100KB, no SVG

    // Profile (extra, spec module 14)
    legalName: { type: String, maxlength: 200, default: "" },
    email: { type: String, maxlength: 254, default: "" },

    // Behaviour flags
    pricesIncludeTax: { type: Boolean, default: true },
    allowNegativeStock: { type: Boolean, default: false },
    lowStockAlertEnabled: { type: Boolean, default: true },
    // Weekly off day: -1 = none, 0 = Sunday … 6 = Saturday. Excluded from "Leave".
    weeklyOff: { type: Number, default: -1 },

    // Tax / invoice / policy
    currency: { type: String, maxlength: 8, default: "INR" },
    fyStartMonth: { type: Number, min: 1, max: 12, default: 4 }, // April
    returnWindowDays: { type: Number, min: 0, max: 365, default: 7 },
    discountApprovalLimit: { type: Number, min: 0, max: 100, default: 0 }, // % above which approval needed

    invoiceSettings: {
      prefix: { type: String, default: "INV" },
      terms: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

export const BusinessModel = models.Business || model("Business", businessSchema);
