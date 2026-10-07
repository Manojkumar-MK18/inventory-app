"use server";

import mongoose from "mongoose";
import { getContext } from "@/lib/context";
import { connectDB } from "@/lib/db";
import { SaleModel } from "@/models/Sale";
import { ReturnModel } from "@/models/Return";
import { BusinessModel } from "@/models/Business";
import { ProductModel } from "@/models/Product";
import { ExpenseModel } from "@/models/Expense";
import { PurchaseModel } from "@/models/Purchase";
import { AttendanceModel } from "@/models/Attendance";
import { CustomerModel } from "@/models/Customer";
import { SupplierModel } from "@/models/Supplier";
import { UserModel } from "@/models/User";

const IST_MS = 5.5 * 60 * 60 * 1000;

/** Convert an IST yyyy-mm-dd (start/end of day) to the UTC instant. */
function istDateToUtc(ymd: string, endOfDay: boolean): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const istMs = Date.UTC(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
  return new Date(istMs - IST_MS);
}

function defaultRange(): { from: Date; to: Date } {
  const ist = new Date(Date.now() + IST_MS);
  const fromMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1);
  return { from: new Date(fromMs - IST_MS), to: new Date() };
}

export interface ReportData {
  from: string;
  to: string;
  totalSales: number; // money billed (after discount) — gross, before returns
  totalDiscount: number; // discount given on sales (item + whole-bill)
  returns: number; // money refunded for returned items in the period
  billCount: number;
  costOfGoods: number; // cost of goods sold, net of returned goods' cost
  grossProfit: number; // (sales − returns) − cost of goods (net)
  gstCollected: number;
  expenses: number;
  netProfit: number; // grossProfit - expenses
  stockValue: number; // current stock × cost
  usesGst: boolean; // true only for GST-registered shops (hide GST UI otherwise)
  gstByRate: { rate: number; taxable: number; tax: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  dailySales: { label: string; total: number }[]; // sales per day over the period
  paymentMix: { method: string; total: number }[]; // how customers paid
}

export async function getReport(fromYmd?: string, toYmd?: string): Promise<ReportData> {
  const ctx = await getContext();
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);

  const range = fromYmd && toYmd ? { from: istDateToUtc(fromYmd, false), to: istDateToUtc(toYmd, true) } : defaultRange();
  const match = { businessId: bId, status: "ISSUED", date: { $gte: range.from, $lte: range.to } };

  const [totals, byRate, top, expenses, stock] = await Promise.all([
    SaleModel.aggregate([
      { $match: match },
      { $group: { _id: null, totalSales: { $sum: "$totals.grandTotal" }, billCount: { $sum: 1 }, gst: { $sum: { $add: ["$totals.cgst", "$totals.sgst", "$totals.igst"] } } } },
    ]),
    SaleModel.aggregate([
      { $match: match },
      { $unwind: "$items" },
      { $group: { _id: "$items.taxRate", taxable: { $sum: "$items.taxable" }, tax: { $sum: { $add: ["$items.cgst", "$items.sgst", "$items.igst"] } } } },
      { $sort: { _id: 1 } },
    ]),
    SaleModel.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          qty: { $sum: "$items.qty" },
          revenue: { $sum: { $add: ["$items.taxable", "$items.cgst", "$items.sgst", "$items.igst"] } },
          cost: { $sum: { $multiply: ["$items.costAtSale", "$items.qty"] } },
          taxable: { $sum: "$items.taxable" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 8 },
    ]),
    ExpenseModel.aggregate([
      { $match: { businessId: bId, date: { $gte: range.from, $lte: range.to } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    ProductModel.aggregate([
      { $match: { businessId: bId, isActive: true } },
      { $group: { _id: null, value: { $sum: { $multiply: ["$currentStock", "$costPrice"] } } } },
    ]),
  ]);

  // Cost of the goods that were sold + the item-level discount given.
  const profitAgg = await SaleModel.aggregate([
    { $match: match },
    { $unwind: "$items" },
    { $group: { _id: null, cost: { $sum: { $multiply: ["$items.costAtSale", "$items.qty"] } }, itemDiscount: { $sum: "$items.discount" } } },
  ]);
  // Whole-bill discounts (stored once per sale, not per item).
  const billDiscAgg = await SaleModel.aggregate([
    { $match: match },
    { $group: { _id: null, billDiscount: { $sum: { $ifNull: ["$billDiscount", 0] } } } },
  ]);
  // Returns in the period: money refunded + cost of the goods that came back.
  const returnAgg = await ReturnModel.aggregate([
    { $match: { businessId: bId, date: { $gte: range.from, $lte: range.to } } },
    { $unwind: "$items" },
    { $group: { _id: null, refund: { $sum: "$items.refundTotal" }, cost: { $sum: { $multiply: ["$items.costAtSale", "$items.qty"] } } } },
  ]);
  const returns = returnAgg[0]?.refund ?? 0;
  const returnedCost = returnAgg[0]?.cost ?? 0;

  const grossCost = profitAgg[0]?.cost ?? 0;
  const costOfGoods = Math.max(0, grossCost - returnedCost); // net of returned goods
  const totalDiscount = (profitAgg[0]?.itemDiscount ?? 0) + (billDiscAgg[0]?.billDiscount ?? 0);
  const totalSales = totals[0]?.totalSales ?? 0;
  const gstCollected = totals[0]?.gst ?? 0;
  const expensesTotal = expenses[0]?.total ?? 0;
  // Profit from goods = (money billed − returns) − GST (not yours) − net cost of goods.
  const grossProfit = totalSales - returns - gstCollected - costOfGoods;

  const biz = await BusinessModel.findById(bId).lean<{ gstType: string }>();
  const usesGst = biz?.gstType === "REGULAR" || gstCollected > 0;

  // Daily sales across the period + how customers paid.
  const [dailyAgg, payAgg] = await Promise.all([
    SaleModel.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "Asia/Kolkata" } }, total: { $sum: "$totals.grandTotal" } } },
      { $sort: { _id: 1 } },
    ]),
    SaleModel.aggregate([
      { $match: match },
      { $group: { _id: { $ifNull: ["$paymentMethod", "CASH"] }, total: { $sum: "$totals.grandTotal" } } },
    ]),
  ]);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dailySales = dailyAgg.map((d: any) => {
    const [, mm, dd] = d._id.split("-");
    return { label: `${Number(dd)} ${MONTHS[Number(mm) - 1]}`, total: d.total };
  });
  const payMap = new Map<string, number>(payAgg.map((p: any) => [p._id ?? "CASH", p.total]));
  const paymentMix = ["CASH", "UPI", "CARD", "CREDIT"]
    .map((m) => ({ method: m, total: payMap.get(m) ?? 0 }))
    .filter((p) => p.total > 0);

  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    totalSales,
    totalDiscount,
    returns,
    billCount: totals[0]?.billCount ?? 0,
    costOfGoods,
    grossProfit,
    gstCollected,
    expenses: expensesTotal,
    netProfit: grossProfit - expensesTotal,
    stockValue: stock[0]?.value ?? 0,
    usesGst,
    gstByRate: byRate.map((r: any) => ({ rate: r._id ?? 0, taxable: r.taxable, tax: r.tax })),
    topProducts: top.map((t: any) => ({ name: t._id, qty: t.qty, revenue: t.revenue })),
    dailySales,
    paymentMix,
  };
}

/** A full data export for a date range — every section the shop needs, in one shot. */
export interface FullReport {
  from: string;
  to: string;
  businessName: string;
  summary: { label: string; value: string }[];
  salesHeaders: string[];
  sales: (string | number)[][];
  purchases: (string | number)[][];
  expenses: (string | number)[][];
  attendance: (string | number)[][];
  customers: (string | number)[][];
  suppliers: (string | number)[][];
}

const rupees = (paise: number) => (paise / 100).toFixed(2);
const istDate = (d: Date) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const istTime = (d: Date | null) => (d ? new Date(d).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "");

export async function getFullReport(fromYmd: string, toYmd: string): Promise<FullReport> {
  const ctx = await getContext();
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const from = istDateToUtc(fromYmd, false);
  const to = istDateToUtc(toYmd, true);
  const inRange = { date: { $gte: from, $lte: to } };

  const [report, sales, purchases, expenses, attendance, customers, suppliers, users, biz] = await Promise.all([
    getReport(fromYmd, toYmd),
    SaleModel.find({ businessId: bId, ...inRange }).sort({ date: 1 }).lean(),
    PurchaseModel.find({ businessId: bId, ...inRange }).sort({ date: 1 }).lean(),
    ExpenseModel.find({ businessId: bId, ...inRange }).sort({ date: 1 }).lean(),
    AttendanceModel.find({ businessId: bId, dayKey: { $gte: fromYmd, $lte: toYmd } }).sort({ dayKey: 1 }).lean(),
    CustomerModel.find({ businessId: bId }).sort({ name: 1 }).lean(),
    SupplierModel.find({ businessId: bId }).sort({ name: 1 }).lean(),
    UserModel.find({}).lean(),
    BusinessModel.findById(bId).lean<{ name: string }>(),
  ]);

  const nameById = new Map(users.map((u: any) => [u._id.toString(), u.name]));

  return {
    from: fromYmd,
    to: toYmd,
    businessName: biz?.name ?? "Shop",
    summary: [
      { label: "Period", value: `${fromYmd} to ${toYmd}` },
      { label: "Total sales (money received)", value: `₹${rupees(report.totalSales)}` },
      { label: "Discount given to customers", value: `₹${rupees(report.totalDiscount)}` },
      { label: "Returns (money given back)", value: `₹${rupees(report.returns)}` },
      { label: "Net sales (after returns)", value: `₹${rupees(report.totalSales - report.returns)}` },
      { label: "Number of bills", value: String(report.billCount) },
      { label: "Cost of goods sold (buy price)", value: `₹${rupees(report.costOfGoods)}` },
      { label: "Profit from selling goods", value: `₹${rupees(report.grossProfit)}` },
      { label: "Other expenses", value: `₹${rupees(report.expenses)}` },
      { label: "Final profit you kept", value: `₹${rupees(report.netProfit)}` },
      { label: "Stock value now (unsold goods)", value: `₹${rupees(report.stockValue)}` },
      ...(report.usesGst ? [{ label: "GST collected", value: `₹${rupees(report.gstCollected)}` }] : []),
    ],
    salesHeaders: ["Date", "Invoice", "Customer", "Items", "Discount", "Total", "Payment", "Got cash", "Returned", "Billed by", "Status"],
    sales: sales.map((s: any) => {
      const itemDisc = (s.items ?? []).reduce((a: number, i: any) => a + (i.discount || 0), 0);
      const disc = itemDisc + (s.billDiscount ?? 0);
      const got = s.cashReceived ?? 0;
      const grand = s.totals?.grandTotal ?? 0;
      return [
        istDate(s.date), s.invoiceNo, s.customerSnapshot?.name ?? "Walk-in",
        s.items?.length ?? 0, disc > 0 ? rupees(disc) : "-", rupees(grand),
        s.paymentMethod ?? "CASH", got > 0 ? rupees(got) : "-", got > grand ? rupees(got - grand) : "-",
        s.billedBy || "-", s.status,
      ];
    }),
    purchases: purchases.map((p: any) => [
      istDate(p.date), p.supplierName || "-", p.supplierInvoiceNo || "-",
      p.items?.length ?? 0, rupees(p.totalCost ?? 0),
    ]),
    expenses: expenses.map((e: any) => [istDate(e.date), e.category, rupees(e.amount), e.note || ""]),
    attendance: attendance
      .filter((a: any) => (a.sessions ?? []).length > 0)
      .map((a: any) => {
        const ss = a.sessions as { checkIn: Date; checkOut: Date | null }[];
        const mins = ss.reduce((acc, s) => acc + (s.checkOut ? (new Date(s.checkOut).getTime() - new Date(s.checkIn).getTime()) / 60000 : 0), 0);
        const closed = ss.filter((s) => s.checkOut);
        const open = ss.length > 0 && !ss[ss.length - 1].checkOut;
        return [
          a.dayKey, nameById.get(a.userId.toString()) ?? "-",
          istTime(ss[0].checkIn), istTime(closed.length ? closed[closed.length - 1].checkOut : null),
          ss.length, (mins / 60).toFixed(1), open ? "In progress" : "Present",
        ];
      }),
    customers: customers.map((c: any) => [c.name, c.phone || "", c.area || "", rupees(c.balanceDue ?? 0)]),
    suppliers: suppliers.map((s: any) => [s.name, s.phone || "", s.area || "", rupees(s.balanceDue ?? 0)]),
  };
}
