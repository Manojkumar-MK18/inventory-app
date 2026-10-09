/**
 * The sale transaction. This is the correctness-critical path:
 *  - server computes all money (never trusts client prices)
 *  - atomic invoice counter INSIDE the transaction (no gaps, no duplicates)
 *  - conditional $inc on stock (no overselling the last item)
 *  - idempotencyKey unique index (double-tap / retry can't make two bills)
 */
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import type { Ctx } from "@/lib/session";
import { computeBill, type GstType } from "@/lib/tax";
import { financialYear } from "@/lib/fy";
import { ProductModel } from "@/models/Product";
import { SaleModel } from "@/models/Sale";
import { StockMovementModel } from "@/models/StockMovement";
import { CounterModel } from "@/models/Counter";
import { CustomerModel } from "@/models/Customer";
import { PaymentModel } from "@/models/Payment";

export type PaymentMethod = "CASH" | "UPI" | "CARD" | "CREDIT";

export interface CartItem {
  productId: string;
  qty: number;
  discount?: number; // per-unit paise
  priceOverride?: number; // per-unit paise; staff price override at billing
  variantLabel?: string; // which size, for variant products
}

export interface CreateSaleInput {
  items: CartItem[];
  idempotencyKey: string;
  paymentMethod?: PaymentMethod;
  customer?: { name?: string; phone?: string; area?: string };
  /** Name of the person who made the bill (shown on the receipt). */
  billedBy?: string;
  /** Discount on the whole bill (paise), taken off the final total only. */
  billDiscount?: number;
  /** Cash the customer handed over (paise), for the CASH return record. */
  cashReceived?: number;
  /** Backdate the bill (forgot to generate it). Defaults to now. */
  date?: Date;
  /** Manual invoice number. If omitted, the next number is auto-generated. */
  invoiceNoOverride?: string;
}

export interface BusinessConfig {
  gstType: GstType;
  pricesIncludeTax: boolean;
  stateCode: string;
  allowNegativeStock: boolean;
}

function fmtInvoiceNo(fy: string, seq: number): string {
  // INV/26-27/000124  -> stays under GST's 16-char limit
  const short = fy.slice(2); // "26-27"
  return `INV/${short}/${seq.toString().padStart(6, "0")}`;
}

export function saleRepo(ctx: Ctx, cfg: BusinessConfig) {
  const bId = new mongoose.Types.ObjectId(ctx.businessId);

  return {
    async create(input: CreateSaleInput) {
      await connectDB();

      // Idempotency short-circuit: if this key already made a bill, return it.
      const existing = await SaleModel.findOne({
        businessId: bId,
        idempotencyKey: input.idempotencyKey,
      }).lean();
      if (existing) return existing;

      const now = input.date ?? new Date();
      const fy = financialYear(now);
      const method: PaymentMethod = input.paymentMethod ?? "CASH";
      // Walk-in / same-state billing uses CGST+SGST (no buyer state captured in V1).
      const interState = false;

      const session = await mongoose.startSession();
      try {
        let saved: any;
        await session.withTransaction(async () => {
          // 1. Reload products server-side — never trust client prices.
          const ids = input.items.map((i) => new mongoose.Types.ObjectId(i.productId));
          const products = await ProductModel.find({ businessId: bId, _id: { $in: ids } }).session(
            session
          );
          const byId = new Map(products.map((p) => [p._id.toString(), p]));

          // Resolve the variant (if any) and validate the size selection.
          const variantOf = (i: CartItem, p: any) => {
            const hasVariants = (p.variants ?? []).length > 0;
            if (hasVariants && !i.variantLabel) throw new Error(`Select a size for ${p.name}`);
            if (!i.variantLabel) return null;
            const v = (p.variants ?? []).find((x: any) => x.label === i.variantLabel);
            if (!v) throw new Error(`Size ${i.variantLabel} not found for ${p.name}`);
            return v;
          };

          // 2. Compute money on the server. Price = override, else the variant's price,
          //    else the product price; tax/discount are always recomputed server-side.
          const priceFor = (i: CartItem, p: any) => {
            if (i.priceOverride !== undefined && i.priceOverride >= 0) return i.priceOverride;
            const v = variantOf(i, p);
            return v?.price != null ? v.price : p.salePrice;
          };
          const lineInputs = input.items.map((i) => {
            const p = byId.get(i.productId);
            if (!p) throw new Error(`Product ${i.productId} not found`);
            return { price: priceFor(i, p), qty: i.qty, discount: i.discount ?? 0, taxRate: p.taxRate };
          });
          const bill = computeBill(lineInputs, {
            gstType: cfg.gstType,
            pricesIncludeTax: cfg.pricesIncludeTax,
            interState,
          });
          // Whole-bill discount — clamped and taken off the final total only.
          const billDiscount = Math.max(0, Math.min(input.billDiscount ?? 0, bill.grandTotal));
          const finalTotal = bill.grandTotal - billDiscount;

          // 3. Invoice number — manual override, or atomic auto-increment in the txn.
          let invoiceNo: string;
          if (input.invoiceNoOverride) {
            invoiceNo = input.invoiceNoOverride.trim();
          } else {
            const counter = await CounterModel.findOneAndUpdate(
              { businessId: bId, series: "INV", fy },
              { $inc: { seq: 1 } },
              { new: true, upsert: true, session }
            );
            invoiceNo = fmtInvoiceNo(fy, counter.seq);
          }

          // 4. Decrement stock conditionally, and record movements.
          for (let idx = 0; idx < input.items.length; idx++) {
            const item = input.items[idx];
            const p = byId.get(item.productId)!;
            let res;
            if (item.variantLabel) {
              // Decrement the matching variant's stock (and the product total) atomically.
              // $elemMatch ensures label + stock conditions bind to the SAME variant, so the
              // positional `$` updates the right size.
              const elem: Record<string, unknown> = { label: item.variantLabel };
              if (!cfg.allowNegativeStock) elem.stock = { $gte: item.qty };
              res = await ProductModel.updateOne(
                { businessId: bId, _id: p._id, variants: { $elemMatch: elem } },
                { $inc: { "variants.$.stock": -item.qty, currentStock: -item.qty } },
                { session }
              );
              if (res.matchedCount === 0) throw new Error(`Not enough stock for ${p.name} (${item.variantLabel})`);
            } else {
              const filter: Record<string, unknown> = { businessId: bId, _id: p._id };
              if (!cfg.allowNegativeStock) filter.currentStock = { $gte: item.qty };
              res = await ProductModel.updateOne(filter, { $inc: { currentStock: -item.qty } }, { session });
              if (res.matchedCount === 0) throw new Error(`Not enough stock for ${p.name}`);
            }

            await StockMovementModel.create(
              [
                {
                  businessId: bId,
                  productId: p._id,
                  variantLabel: item.variantLabel ?? "",
                  type: "SALE",
                  qty: -item.qty,
                  refType: "SALE",
                  date: now,
                },
              ],
              { session }
            );
          }

          // 4b. Resolve the customer. A persistent Customer is created/matched ONLY when a
          // phone is given (phone is the dedupe key) — this prevents duplicate "Ramesh"
          // records. A name without a phone is kept as a snapshot on the bill only.
          let customerId: mongoose.Types.ObjectId | undefined;
          let customerSnapshot: Record<string, unknown> | undefined;
          const c = input.customer;
          const phone = c?.phone?.trim();

          if (method === "CREDIT" && !phone) {
            throw new Error("A credit (khata) sale needs the customer's phone number");
          }

          // How much was actually collected now, and how much is still owed (a due).
          // CREDIT (khata): nothing paid now, whole bill is the due.
          // CASH: if the customer gave less than the total, the shortfall is a due.
          // UPI / CARD: taken as fully paid.
          const cashNow = method === "CASH" ? Math.max(0, input.cashReceived ?? 0) : 0;
          let amountPaid: number;
          if (method === "CREDIT") amountPaid = 0;
          else if (method === "CASH" && cashNow > 0 && cashNow < finalTotal) amountPaid = cashNow;
          else amountPaid = finalTotal;
          const dueAmount = finalTotal - amountPaid;

          // Any unpaid part must be tracked against a customer (needs a phone), like khata.
          if (dueAmount > 0 && !phone) {
            throw new Error(`₹${(dueAmount / 100).toFixed(2)} is still to collect — enter the customer's phone so it is saved in their dues (udhaar).`);
          }

          if (phone) {
            let customer = await CustomerModel.findOne({ businessId: bId, phone }).session(session);
            if (!customer) {
              const createdC = await CustomerModel.create(
                [{ businessId: bId, name: c?.name?.trim() || "Customer", phone, area: c?.area?.trim() || "" }],
                { session }
              );
              customer = createdC[0];
            }
            customerId = customer._id;
            customerSnapshot = { customerId, name: customer.name, phone: customer.phone, area: customer.area };
          } else if (c?.name?.trim()) {
            customerSnapshot = { name: c.name.trim(), area: c?.area?.trim() || "" };
          }

          // 5. Insert the sale with snapshotted items.
          const items = input.items.map((item, idx) => {
            const p = byId.get(item.productId)!;
            const l = bill.lines[idx];
            const variant = item.variantLabel ? (p.variants ?? []).find((x: any) => x.label === item.variantLabel) : null;
            const barcode = variant?.barcode || p.barcode || "";
            return {
              productId: p._id,
              name: item.variantLabel ? `${p.name} (${item.variantLabel})` : p.name,
              sku: p.sku ?? "",
              hsn: p.hsn,
              variantLabel: item.variantLabel ?? "",
              barcode,
              qty: item.qty,
              returnedQty: 0,
              price: priceFor(item, p),
              discount: (item.discount ?? 0) * item.qty,
              taxRate: cfg.gstType === "REGULAR" ? p.taxRate : 0,
              taxable: l.taxable,
              cgst: l.cgst,
              sgst: l.sgst,
              igst: l.igst,
              costAtSale: p.costPrice,
            };
          });

          const created = await SaleModel.create(
            [
              {
                businessId: bId,
                invoiceNo,
                fy,
                date: now,
                customerSnapshot,
                items,
                totals: {
                  taxable: bill.taxable,
                  cgst: bill.cgst,
                  sgst: bill.sgst,
                  igst: bill.igst,
                  grandTotal: finalTotal, // after the whole-bill discount
                },
                roundOff: bill.roundOff,
                billDiscount,
                cashReceived: cashNow,
                amountPaid,
                dueAmount,
                paymentMethod: method,
                status: "ISSUED",
                idempotencyKey: input.idempotencyKey,
                createdBy: ctx.userId,
                billedBy: (input.billedBy ?? "").trim(),
              },
            ],
            { session }
          );
          saved = created[0];

          // 6. Money:
          //    - Record a payment for the amount actually collected now (if any).
          //    - Any unpaid part (dueAmount) is added to the customer's khata/dues.
          if (amountPaid > 0) {
            await PaymentModel.create(
              [{ businessId: bId, refType: "SALE", refId: saved._id, method: method === "CREDIT" ? "CASH" : method, amount: amountPaid }],
              { session }
            );
          }
          if (dueAmount > 0) {
            await CustomerModel.updateOne(
              { businessId: bId, _id: customerId },
              { $inc: { balanceDue: dueAmount } },
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
