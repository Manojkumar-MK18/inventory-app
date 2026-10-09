/**
 * The return (credit note) transaction. Mirror image of a sale:
 *  - NEVER edits the original bill — creates a linked Return record
 *  - adds stock back (conditional $inc on the right variant)
 *  - refunds exactly what the customer paid for those units (price − discount
 *    share − whole-bill-discount share), computed from the sale snapshot
 *  - bumps the sale line's returnedQty so the same unit can't be returned twice
 *  - atomic return-number counter inside the transaction
 */
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import type { Ctx } from "@/lib/session";
import { financialYear } from "@/lib/fy";
import { ProductModel } from "@/models/Product";
import { SaleModel } from "@/models/Sale";
import { ReturnModel } from "@/models/Return";
import { StockMovementModel } from "@/models/StockMovement";
import { CounterModel } from "@/models/Counter";
import { CustomerModel } from "@/models/Customer";
import { PaymentModel } from "@/models/Payment";

export type RefundMethod = "CASH" | "UPI" | "CARD" | "ADJUST_DUES";

export type ReturnKind = "RETURN" | "EXCHANGE" | "DAMAGE";

export interface ReturnLineInput {
  lineIndex: number; // index into the sale's items[]
  qty: number; // how many to return from that line
}
export interface CreateReturnInput {
  saleId: string;
  lines: ReturnLineInput[];
  kind?: ReturnKind; // RETURN (default) | EXCHANGE | DAMAGE
  refundMethod?: RefundMethod;
  exchangeSaleId?: mongoose.Types.ObjectId; // link to the new bill (exchanges)
  exchangeInvoiceNo?: string;
  billedBy?: string;
  note?: string;
}

function fmtReturnNo(fy: string, seq: number): string {
  return `RET/${fy.slice(2)}/${seq.toString().padStart(6, "0")}`;
}

/**
 * What the customer actually paid per unit of a sale line — the amount to
 * refund. = (line net incl. tax − the line's share of the whole-bill discount)
 * ÷ line qty. Uses the snapshot, so it's exactly what was charged.
 */
function refundPerUnit(line: any, sale: any): number {
  const lineNet = (line.taxable ?? 0) + (line.cgst ?? 0) + (line.sgst ?? 0) + (line.igst ?? 0);
  const billDisc = sale.billDiscount ?? 0;
  let share = 0;
  if (billDisc > 0) {
    const totalNet = (sale.items ?? []).reduce(
      (a: number, l: any) => a + (l.taxable ?? 0) + (l.cgst ?? 0) + (l.sgst ?? 0) + (l.igst ?? 0),
      0
    );
    if (totalNet > 0) share = Math.round((billDisc * lineNet) / totalNet);
  }
  const paidForLine = Math.max(0, lineNet - share);
  return line.qty > 0 ? Math.round(paidForLine / line.qty) : 0;
}

export function returnRepo(ctx: Ctx) {
  const bId = new mongoose.Types.ObjectId(ctx.businessId);

  return {
    async create(input: CreateReturnInput) {
      await connectDB();
      const method: RefundMethod = input.refundMethod ?? "CASH";
      const kind: ReturnKind = input.kind ?? "RETURN";
      const damaged = kind === "DAMAGE";

      const session = await mongoose.startSession();
      try {
        let saved: any;
        await session.withTransaction(async () => {
          const sale = await SaleModel.findOne({ businessId: bId, _id: input.saleId }).session(session);
          if (!sale) throw new Error("Original bill not found");
          if (sale.status !== "ISSUED") throw new Error("This bill is cancelled — cannot return");

          const now = new Date();
          const fy = financialYear(now);
          const retItems: any[] = [];
          let totalRefund = 0;

          for (const req of input.lines) {
            if (req.qty <= 0) continue;
            const line = sale.items[req.lineIndex];
            if (!line) throw new Error("Item not found on the bill");
            const already = line.returnedQty ?? 0;
            const left = line.qty - already;
            if (req.qty > left) throw new Error(`Only ${left} left to return for ${line.name}`);

            const per = refundPerUnit(line, sale);
            const refundTotal = per * req.qty;
            totalRefund += refundTotal;

            // RETURN / EXCHANGE: item is resellable → back to sellable stock.
            // DAMAGE: item is written off → add to damagedStock, NOT sellable stock.
            if (line.variantLabel) {
              const inc = damaged
                ? { "variants.$.damagedStock": req.qty, damagedStock: req.qty }
                : { "variants.$.stock": req.qty, currentStock: req.qty };
              await ProductModel.updateOne(
                { businessId: bId, _id: line.productId, variants: { $elemMatch: { label: line.variantLabel } } },
                { $inc: inc },
                { session }
              );
            } else {
              const inc = damaged ? { damagedStock: req.qty } : { currentStock: req.qty };
              await ProductModel.updateOne(
                { businessId: bId, _id: line.productId },
                { $inc: inc },
                { session }
              );
            }

            await StockMovementModel.create(
              [{ businessId: bId, productId: line.productId, variantLabel: line.variantLabel ?? "", type: damaged ? "DAMAGE" : "SALE_RETURN", qty: req.qty, refType: "RETURN", date: now }],
              { session }
            );

            line.returnedQty = already + req.qty; // mark on the original line (no money edited)

            retItems.push({
              productId: line.productId,
              name: line.name,
              variantLabel: line.variantLabel ?? "",
              barcode: line.barcode ?? "",
              qty: req.qty,
              refundPerUnit: per,
              refundTotal,
              costAtSale: line.costAtSale ?? 0,
            });
          }

          if (retItems.length === 0) throw new Error("Nothing selected to return");

          await sale.save({ session }); // persists the updated returnedQty only

          const counter = await CounterModel.findOneAndUpdate(
            { businessId: bId, series: "RET", fy },
            { $inc: { seq: 1 } },
            { new: true, upsert: true, session }
          );
          const returnNo = fmtReturnNo(fy, counter.seq);

          const customerId = sale.customerSnapshot?.customerId;
          const created = await ReturnModel.create(
            [
              {
                businessId: bId,
                returnNo,
                date: now,
                kind,
                exchangeSaleId: input.exchangeSaleId,
                exchangeInvoiceNo: input.exchangeInvoiceNo ?? "",
                originalSaleId: sale._id,
                originalInvoiceNo: sale.invoiceNo,
                customerSnapshot: customerId
                  ? { customerId, name: sale.customerSnapshot?.name, phone: sale.customerSnapshot?.phone }
                  : { name: sale.customerSnapshot?.name },
                items: retItems,
                totalRefund,
                refundMethod: method,
                note: input.note ?? "",
                createdBy: ctx.userId,
                billedBy: (input.billedBy ?? "").trim(),
              },
            ],
            { session }
          );
          saved = created[0];

          // Money back: either reduce the customer's dues, or record a cash-out.
          if (method === "ADJUST_DUES") {
            if (!customerId) throw new Error("No customer on this bill — choose Cash refund instead");
            await CustomerModel.updateOne(
              { businessId: bId, _id: customerId },
              { $inc: { balanceDue: -totalRefund } },
              { session }
            );
          } else {
            await PaymentModel.create(
              [{ businessId: bId, refType: "RETURN", refId: saved._id, method, amount: -totalRefund }],
              { session }
            );
          }
        });
        return saved;
      } finally {
        await session.endSession();
      }
    },
  };
}
