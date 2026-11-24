/**
 * Purchase = stock-in. In one transaction per purchase:
 *  - increase each product's currentStock
 *  - update costPrice as a weighted average of old and new stock
 *  - record a PURCHASE stock movement
 *  - insert the purchase document
 */
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import type { Ctx } from "@/lib/session";
import { ProductModel } from "@/models/Product";
import { PurchaseModel } from "@/models/Purchase";
import { StockMovementModel } from "@/models/StockMovement";
import { SupplierModel } from "@/models/Supplier";
import { PaymentModel } from "@/models/Payment";

export interface PurchaseLine {
  productId: string;
  qty: number;
  cost: number; // per-unit cost in paise
  variantLabel?: string; // which size, for variant products
}

export interface CreatePurchaseInput {
  supplierName?: string;
  supplierInvoiceNo?: string;
  date?: Date; // received date (defaults to now)
  invoiceDate?: Date | null;
  otherCharges?: number; // paise
  discountAmount?: number; // paise
  paymentStatus?: "UNPAID" | "PARTIAL" | "PAID";
  amountPaid?: number; // paise
  paymentMode?: "CASH" | "UPI" | "BANK" | "CHEQUE";
  referenceNo?: string;
  notes?: string;
  createdBy?: string;
  items: PurchaseLine[];
}

/** Weighted-average cost: (oldStock*oldCost + qty*newCost) / (oldStock + qty). */
function weightedAvg(oldStock: number, oldCost: number, qty: number, newCost: number): number {
  const totalQty = oldStock + qty;
  if (totalQty <= 0) return newCost;
  return Math.round((oldStock * oldCost + qty * newCost) / totalQty);
}

export function purchaseRepo(ctx: Ctx) {
  const bId = new mongoose.Types.ObjectId(ctx.businessId);

  return {
    async create(input: CreatePurchaseInput) {
      await connectDB();
      const when = input.date ?? new Date();
      const ids = input.items.map((i) => new mongoose.Types.ObjectId(i.productId));

      const session = await mongoose.startSession();
      try {
        let saved: any;
        await session.withTransaction(async () => {
          // Every purchase is its own record — the same supplier + same invoice number is
          // allowed (invoice numbers aren't reliably unique, and real repeat buys must add stock).
          const products = await ProductModel.find({ businessId: bId, _id: { $in: ids } }).session(session);
          const byId = new Map(products.map((p) => [p._id.toString(), p]));

          let totalCost = 0;
          const items: any[] = [];

          for (const line of input.items) {
            const p = byId.get(line.productId);
            if (!p) throw new Error(`Product ${line.productId} not found`);
            const hasVariants = (p.variants ?? []).length > 0;
            if (hasVariants && !line.variantLabel) throw new Error(`Select a size for ${p.name}`);

            const newCost = weightedAvg(p.currentStock, p.costPrice ?? 0, line.qty, line.cost);
            if (line.variantLabel) {
              const res = await ProductModel.updateOne(
                { businessId: bId, _id: p._id, "variants.label": line.variantLabel },
                { $inc: { "variants.$.stock": line.qty, currentStock: line.qty }, $set: { costPrice: newCost } },
                { session }
              );
              if (res.matchedCount === 0) throw new Error(`Size ${line.variantLabel} not found for ${p.name}`);
            } else {
              await ProductModel.updateOne(
                { businessId: bId, _id: p._id },
                { $inc: { currentStock: line.qty }, $set: { costPrice: newCost } },
                { session }
              );
            }
            await StockMovementModel.create(
              [{ businessId: bId, productId: p._id, variantLabel: line.variantLabel ?? "", type: "PURCHASE", qty: line.qty, refType: "PURCHASE", date: when }],
              { session }
            );

            totalCost += line.qty * line.cost;
            items.push({ productId: p._id, name: line.variantLabel ? `${p.name} (${line.variantLabel})` : p.name, variantLabel: line.variantLabel ?? "", qty: line.qty, cost: line.cost, taxRate: p.taxRate });
          }

          // Grand total = goods + freight − discount.
          const subtotal = totalCost;
          const other = input.otherCharges ?? 0;
          const disc = input.discountAmount ?? 0;
          const grand = Math.max(0, subtotal + other - disc);

          // How much is paid now vs still owed, from the chosen status.
          const status = input.paymentStatus ?? "PAID";
          const paid = status === "PAID" ? grand : status === "PARTIAL" ? Math.min(grand, input.amountPaid ?? 0) : 0;
          const due = Math.max(0, grand - paid);

          const supName = (input.supplierName ?? "").trim();
          if (due > 0 && !supName) throw new Error("An unpaid / partial purchase needs a supplier name");

          // Link or create the supplier, and add what we still owe them.
          let supplierId: mongoose.Types.ObjectId | null = null;
          if (supName) {
            const escaped = supName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            let supplier = await SupplierModel.findOne({ businessId: bId, name: { $regex: `^${escaped}$`, $options: "i" } }).session(session);
            if (!supplier) {
              const c = await SupplierModel.create([{ businessId: bId, name: supName }], { session });
              supplier = c[0];
            }
            supplierId = supplier._id;
            if (due > 0) {
              await SupplierModel.updateOne({ businessId: bId, _id: supplier._id }, { $inc: { balanceDue: due } }, { session });
            }
          }

          const created = await PurchaseModel.create(
            [{
              businessId: bId,
              supplierId,
              supplierName: supName,
              supplierInvoiceNo: input.supplierInvoiceNo ?? "",
              date: when,
              invoiceDate: input.invoiceDate ?? null,
              items,
              subtotal,
              otherCharges: other,
              discountAmount: disc,
              totalCost: grand,
              paymentStatus: status,
              amountPaid: paid,
              dueAmount: due,
              paymentMode: input.paymentMode ?? "CASH",
              referenceNo: input.referenceNo ?? "",
              notes: input.notes ?? "",
              paymentMethod: due > 0 ? "CREDIT" : "PAID",
              createdBy: input.createdBy ?? ctx.userId,
            }],
            { session }
          );
          saved = created[0];

          // Record the payment made now (if any) against the supplier ledger.
          if (paid > 0) {
            await PaymentModel.create(
              [{ businessId: bId, refType: "PURCHASE", refId: saved._id, method: input.paymentMode ?? "CASH", amount: paid }],
              { session }
            );
          }
        });
        return saved;
      } finally {
        await session.endSession();
      }
    },

    async list(limit = 100) {
      await connectDB();
      return PurchaseModel.find({ businessId: bId }).sort({ date: -1 }).limit(limit).lean();
    },
  };
}
