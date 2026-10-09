import { Schema, model, models } from "mongoose";
import { tenantPlugin } from "./plugins/tenant";

/** Line items are embedded, with price/tax/cost SNAPSHOTTED at sale time. */
const saleItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: String, // snapshot
    sku: { type: String, default: "" }, // snapshot — product code, printed on bills
    hsn: String, // snapshot
    variantLabel: { type: String, default: "" }, // size, snapshot (for returns + stock)
    barcode: { type: String, default: "" }, // snapshot — lets returns find the item by scan
    qty: { type: Number, required: true },
    returnedQty: { type: Number, default: 0 }, // how many of this line were returned
    price: Number, // paise, snapshot
    discount: { type: Number, default: 0 }, // paise
    taxRate: Number, // snapshot
    taxable: Number,
    cgst: Number,
    sgst: Number,
    igst: Number,
    costAtSale: Number, // paise, for profit reports
  },
  { _id: false }
);

const saleSchema = new Schema(
  {
    invoiceNo: { type: String, required: true },
    fy: { type: String, required: true },
    date: { type: Date, default: () => new Date() },
    customerSnapshot: {
      customerId: Schema.Types.ObjectId,
      name: String,
      phone: String,
      area: String,
      gstin: String,
      stateCode: String,
    },
    items: [saleItemSchema],
    totals: {
      taxable: Number,
      cgst: Number,
      sgst: Number,
      igst: Number,
      grandTotal: Number,
    },
    roundOff: { type: Number, default: 0 },
    billDiscount: { type: Number, default: 0 }, // paise, discount on the whole bill (off the final total)
    cashReceived: { type: Number, default: 0 }, // paise the customer handed over (CASH only; 0 = not recorded)
    amountPaid: { type: Number, default: 0 }, // paise actually collected at bill time (rest, if any, is a due)
    dueAmount: { type: Number, default: 0 }, // paise still owed on this bill (goes to customer khata)
    paymentMethod: { type: String, enum: ["CASH", "UPI", "CARD", "CREDIT"], default: "CASH" },
    status: { type: String, enum: ["ISSUED", "CANCELLED"], default: "ISSUED" },
    idempotencyKey: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    billedBy: { type: String, default: "" }, // name of the person who made the bill (shown on receipt)
  },
  { timestamps: true }
);

saleSchema.plugin(tenantPlugin);
saleSchema.index({ businessId: 1, fy: 1, invoiceNo: 1 }, { unique: true });
saleSchema.index({ businessId: 1, idempotencyKey: 1 }, { unique: true });
saleSchema.index({ businessId: 1, date: -1 });

export const SaleModel = models.Sale || model("Sale", saleSchema);
