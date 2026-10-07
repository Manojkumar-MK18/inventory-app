"use server";

import mongoose from "mongoose";
import { getContext } from "@/lib/context";
import { connectDB } from "@/lib/db";
import { SaleModel } from "@/models/Sale";
import { ProductModel } from "@/models/Product";
import { CustomerModel } from "@/models/Customer";
import { ReturnModel } from "@/models/Return";

const IST_MS = 5.5 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** UTC instant of the most recent IST midnight (start of "today" for the shop). */
function istTodayStartUtc(): Date {
  const ist = new Date(Date.now() + IST_MS);
  const istMidnight = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  return new Date(istMidnight - IST_MS);
}

/** A product is low on stock when it's a simple product at/below its alert level,
 *  OR a variant product with any size at/below that size's own alert level. */
const LOW_STOCK_EXPR = {
  $or: [
    { $and: [{ $eq: [{ $size: { $ifNull: ["$variants", []] } }, 0] }, { $lte: ["$currentStock", "$minStock"] }] },
    {
      $gt: [
        { $size: { $filter: { input: { $ifNull: ["$variants", []] }, as: "v", cond: { $lte: ["$$v.stock", "$$v.minStock"] } } } },
        0,
      ],
    },
  ],
};

function hourLabel(h: number): string {
  const ampm = h < 12 ? "a" : "p";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${ampm}`;
}

export interface DashboardStats {
  todaySales: number;
  todayBills: number;
  todayReturns: number; // paise refunded today
  salesChangePct: number | null; // today's sales vs yesterday (null = no prior data)
  billsChangePct: number | null; // today's bills vs yesterday
  monthChangePct: number | null; // this month's sales vs last month
  monthSales: number;
  monthReturns: number; // paise refunded this month
  totalProducts: number;
  lowStock: number;
  avgBill: number;
  receivable: number; // paise customers owe (khata)
  trend14: { label: string; total: number }[]; // last 14 days
  paymentMix: { method: string; total: number }[];
  byCategory: { category: string; total: number }[];
  byHour: { label: string; total: number }[];
  recent: { invoiceNo: string; date: string; total: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  lowStockItems: { name: string; currentStock: number; minStock: number; unit: string }[];
}

const LINE_REVENUE = { $add: ["$items.taxable", "$items.cgst", "$items.sgst", "$items.igst"] };

/** % change of cur vs prev. null when there's no prior value to compare against. */
function changePct(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10; // 1 decimal
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const ctx = await getContext();
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);

  const todayStart = istTodayStartUtc();
  const monthStart = new Date(todayStart.getTime());
  monthStart.setUTCDate(1);
  const trendStart = new Date(todayStart.getTime() - 13 * 86400000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const lastMonthStart = new Date(monthStart);
  lastMonthStart.setUTCMonth(lastMonthStart.getUTCMonth() - 1);

  const monthMatch = { businessId: bId, status: "ISSUED", date: { $gte: monthStart } };

  const [today, month, totalProducts, lowStock, recent, daily, top, lowItems, payMix, cats, hours, recv, todayRet, monthRet, yday, lastMonth] =
    await Promise.all([
      SaleModel.aggregate([
        { $match: { businessId: bId, status: "ISSUED", date: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: "$totals.grandTotal" }, count: { $sum: 1 } } },
      ]),
      SaleModel.aggregate([
        { $match: monthMatch },
        { $group: { _id: null, total: { $sum: "$totals.grandTotal" }, count: { $sum: 1 } } },
      ]),
      ProductModel.countDocuments({ businessId: bId, isActive: true }),
      ProductModel.countDocuments({ businessId: bId, isActive: true, $expr: LOW_STOCK_EXPR }),
      SaleModel.find({ businessId: bId, status: "ISSUED" }).sort({ date: -1 }).limit(5).lean(),
      // 14-day daily trend
      SaleModel.aggregate([
        { $match: { businessId: bId, status: "ISSUED", date: { $gte: trendStart } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "Asia/Kolkata" } }, total: { $sum: "$totals.grandTotal" } } },
      ]),
      // top products this month
      SaleModel.aggregate([
        { $match: monthMatch },
        { $unwind: "$items" },
        { $group: { _id: "$items.name", qty: { $sum: "$items.qty" }, revenue: { $sum: LINE_REVENUE } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
      ProductModel.find({ businessId: bId, isActive: true, $expr: LOW_STOCK_EXPR })
        .sort({ currentStock: 1 }).limit(8).lean(),
      // payment mix this month (treat a missing method as CASH)
      SaleModel.aggregate([
        { $match: monthMatch },
        { $group: { _id: { $ifNull: ["$paymentMethod", "CASH"] }, total: { $sum: "$totals.grandTotal" } } },
      ]),
      // sales by category this month (join to products for category)
      SaleModel.aggregate([
        { $match: monthMatch },
        { $unwind: "$items" },
        { $lookup: { from: "products", localField: "items.productId", foreignField: "_id", as: "p" } },
        { $set: { catRaw: { $ifNull: [{ $arrayElemAt: ["$p.categoryName", 0] }, ""] } } },
        { $set: { cat: { $cond: [{ $eq: ["$catRaw", ""] }, "Uncategorised", "$catRaw"] } } },
        { $group: { _id: "$cat", total: { $sum: LINE_REVENUE } } },
        { $sort: { total: -1 } },
        { $limit: 3 },
      ]),
      // sales by hour over last 7 days (peak hours)
      SaleModel.aggregate([
        { $match: { businessId: bId, status: "ISSUED", date: { $gte: weekStart } } },
        { $group: { _id: { $hour: { date: "$date", timezone: "Asia/Kolkata" } }, total: { $sum: "$totals.grandTotal" } } },
      ]),
      // receivables (khata)
      CustomerModel.aggregate([
        { $match: { businessId: bId } },
        { $group: { _id: null, total: { $sum: "$balanceDue" } } },
      ]),
      // returns refunded today / this month
      ReturnModel.aggregate([
        { $match: { businessId: bId, date: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: "$totalRefund" } } },
      ]),
      ReturnModel.aggregate([
        { $match: { businessId: bId, date: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$totalRefund" } } },
      ]),
      // yesterday (for the vs-yesterday comparison)
      SaleModel.aggregate([
        { $match: { businessId: bId, status: "ISSUED", date: { $gte: yesterdayStart, $lt: todayStart } } },
        { $group: { _id: null, total: { $sum: "$totals.grandTotal" }, count: { $sum: 1 } } },
      ]),
      // last month (for the vs-last-month comparison)
      SaleModel.aggregate([
        { $match: { businessId: bId, status: "ISSUED", date: { $gte: lastMonthStart, $lt: monthStart } } },
        { $group: { _id: null, total: { $sum: "$totals.grandTotal" } } },
      ]),
    ]);

  // 14-day trend, filling gaps
  const dailyMap = new Map<string, number>(daily.map((d: any) => [d._id, d.total]));
  const trend14 = Array.from({ length: 14 }, (_, i) => {
    const dayUtc = new Date(todayStart.getTime() - (13 - i) * 86400000);
    const ist = new Date(dayUtc.getTime() + IST_MS);
    const key = `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`;
    return { label: `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}`, total: dailyMap.get(key) ?? 0 };
  });

  // payment mix in fixed order
  const payMap = new Map<string, number>(payMix.map((p: any) => [p._id ?? "CASH", p.total]));
  const paymentMix = ["CASH", "UPI", "CARD", "CREDIT"]
    .map((m) => ({ method: m, total: payMap.get(m) ?? 0 }))
    .filter((p) => p.total > 0);

  // peak hours: continuous range covering hours with data
  const hourMap = new Map<number, number>(hours.map((h: any) => [h._id, h.total]));
  const present = [...hourMap.keys()].sort((a, b) => a - b);
  let byHour: { label: string; total: number }[] = [];
  if (present.length) {
    const lo = present[0], hi = present[present.length - 1];
    for (let h = lo; h <= hi; h++) byHour.push({ label: hourLabel(h), total: hourMap.get(h) ?? 0 });
  }

  const monthCount = month[0]?.count ?? 0;
  const monthTotal = month[0]?.total ?? 0;

  return {
    todaySales: today[0]?.total ?? 0,
    todayBills: today[0]?.count ?? 0,
    todayReturns: todayRet[0]?.total ?? 0,
    salesChangePct: changePct(today[0]?.total ?? 0, yday[0]?.total ?? 0),
    billsChangePct: changePct(today[0]?.count ?? 0, yday[0]?.count ?? 0),
    monthChangePct: changePct(monthTotal, lastMonth[0]?.total ?? 0),
    monthReturns: monthRet[0]?.total ?? 0,
    monthSales: monthTotal,
    totalProducts,
    lowStock,
    avgBill: monthCount > 0 ? Math.round(monthTotal / monthCount) : 0,
    receivable: recv[0]?.total ?? 0,
    trend14,
    paymentMix,
    byCategory: cats.map((c: any) => ({ category: c._id, total: c.total })),
    byHour,
    recent: recent.map((s: any) => ({ invoiceNo: s.invoiceNo, date: new Date(s.date).toISOString(), total: s.totals?.grandTotal ?? 0 })),
    topProducts: top.map((t: any) => ({ name: t._id, qty: t.qty, revenue: t.revenue })),
    lowStockItems: lowItems.map((p: any) => ({ name: p.name, currentStock: p.currentStock ?? 0, minStock: p.minStock ?? 0, unit: p.unit ?? "pcs" })),
  };
}
