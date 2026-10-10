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
  paymentMethod?: "PAID" | "CREDIT";
  date?: Date; // purchase date (defaults to now)
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

          // Same supplier + same invoice number -> MERGE into that existing invoice
          // (add these items, add to its total) instead of making a second row.
          // Different invoice (or blank) -> a new row. Stock/cost above already applied.
          const supNameTrim = (input.supplierName ?? "").trim();
          const invNoTrim = (input.supplierInvoiceNo ?? "").trim();
          let existing: any = null;
          if (supNameTrim && invNoTrim) {
            const esc = supNameTrim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            existing = await PurchaseModel.findOne({
              businessId: bId,
              supplierInvoiceNo: invNoTrim,
              supplierName: { $regex: `^${esc}$`, $options: "i" },
            }).session(session);
          }

          if (existing) {
            existing.items.push(...items);
            existing.totalCost += totalCost;
            await existing.save({ session });
            saved = existing;
          } else {
            const created = await PurchaseModel.create(
              [
                {
                  businessId: bId,
                  supplierName: input.supplierName ?? "",
                  supplierInvoiceNo: input.supplierInvoiceNo ?? "",
                  date: when,
                  items,
                  totalCost,
                  paymentMethod: input.paymentMethod ?? "PAID",
                  createdBy: ctx.userId,
                },
              ],
              { session }
            );
            saved = created[0];
          }

          // Link the supplier for EVERY named purchase so they appear under Suppliers.
          const method = input.paymentMethod ?? "PAID";
          const name = (input.supplierName ?? "").trim();
          if (method === "CREDIT" && !name) throw new Error("A credit purchase needs a supplier name");

          if (name) {
            // Match an existing supplier case-insensitively (and trimmed) so "Zudio",
            // "zudio" and "Zudio " all reuse the same record instead of duplicating.
            const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            let supplier = await SupplierModel.findOne({
              businessId: bId,
              name: { $regex: `^${escaped}$`, $options: "i" },
            }).session(session);
            if (!supplier) {
              const createdS = await SupplierModel.create([{ businessId: bId, name }], { session });
              supplier = createdS[0];
            }
            // Credit adds to what you owe them; paid leaves the balance unchanged.
            if (method === "CREDIT") {
              await SupplierModel.updateOne(
                { businessId: bId, _id: supplier._id },
                { $inc: { balanceDue: totalCost } },
                { session }
              );
            }
          }

          if (method !== "CREDIT") {
            await PaymentModel.create(
              [{ businessId: bId, refType: "PURCHASE", refId: saved._id, method: "CASH", amount: totalCost }],
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
