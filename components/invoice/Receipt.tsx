"use client";

import { Fragment } from "react";
import { formatINR } from "@/lib/money";
import type { SavedSale } from "@/actions/sales";

const payLabel = (m: string) => (m === "CREDIT" ? "Due" : m === "CASH" ? "Cash" : m === "CARD" ? "Card" : m);

/**
 * 80mm thermal-style receipt. Rendered into #receipt; print CSS in globals.css
 * shows only this element and sizes the page to 80mm.
 */
export function Receipt({
  sale,
  businessName,
  gstin,
}: {
  sale: SavedSale;
  businessName: string;
  gstin: string | null;
}) {
  const t = sale.totals;
  const hasGst = t.cgst + t.sgst + t.igst > 0;
  const gross = sale.items.reduce((a, i) => a + i.price * i.qty, 0);
  const totalDiscount = sale.items.reduce((a, i) => a + (i.discount || 0), 0);

  return (
    <div id="receipt" className="mx-auto w-[80mm] bg-white p-2 font-mono text-[11px] text-black">
      <div className="text-center">
        <div className="text-sm font-bold">{businessName}</div>
        {gstin && <div>GSTIN: {gstin}</div>}
        <div className="mt-1">Invoice: {sale.invoiceNo}</div>
        <div>{new Date(sale.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</div>
        {sale.billedBy && <div>Billed by: {sale.billedBy}</div>}
      </div>

      <div className="my-1 border-t border-dashed border-black" />

      <table className="w-full">
        <thead>
          <tr className="text-left">
            <th>Item</th><th className="text-right">Qty</th>
            <th className="text-right">Rate</th><th className="text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((i, idx) => {
            const lineTotal = i.taxable + i.cgst + i.sgst + i.igst;
            return (
              <Fragment key={idx}>
                <tr>
                  <td className="pr-1">{i.name}</td>
                  <td className="text-right">{i.qty}</td>
                  <td className="text-right">{formatINR(i.price)}</td>
                  <td className="text-right">{formatINR(lineTotal)}</td>
                </tr>
                {i.discount > 0 && (
                  <tr className="text-green-700">
                    <td className="pl-2" colSpan={3}>&nbsp;&nbsp;discount</td>
                    <td className="text-right">− {formatINR(i.discount)}</td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      <div className="my-1 border-t border-dashed border-black" />

      <div className="flex justify-between"><span>Items total</span><span>{formatINR(gross)}</span></div>
      {totalDiscount > 0 && (
        <div className="flex justify-between font-bold"><span>Discount</span><span>− {formatINR(totalDiscount)}</span></div>
      )}
      <div className="flex justify-between"><span>Taxable</span><span>{formatINR(t.taxable)}</span></div>
      {hasGst && t.igst > 0 && (
        <div className="flex justify-between"><span>IGST</span><span>{formatINR(t.igst)}</span></div>
      )}
      {hasGst && t.igst === 0 && (
        <>
          <div className="flex justify-between"><span>CGST</span><span>{formatINR(t.cgst)}</span></div>
          <div className="flex justify-between"><span>SGST</span><span>{formatINR(t.sgst)}</span></div>
        </>
      )}
      {sale.roundOff !== 0 && (
        <div className="flex justify-between"><span>Round off</span><span>{formatINR(sale.roundOff)}</span></div>
      )}
      {sale.billDiscount > 0 && (
        <div className="flex justify-between font-bold"><span>Bill discount</span><span>− {formatINR(sale.billDiscount)}</span></div>
      )}
      <div className="mt-1 flex justify-between border-t border-black pt-1 text-sm font-bold">
        <span>TOTAL</span><span>{formatINR(t.grandTotal)}</span>
      </div>
      {totalDiscount + sale.billDiscount > 0 && (
        <div className="mt-1 text-center font-bold">You saved {formatINR(totalDiscount + sale.billDiscount)}</div>
      )}

      <div className="my-1 border-t border-dashed border-black" />
      <div className="flex justify-between"><span>Payment</span><span>{payLabel(sale.paymentMethod)}</span></div>
      {sale.paymentMethod === "CASH" && sale.cashReceived > 0 && (
        <>
          <div className="flex justify-between"><span>Cash received</span><span>{formatINR(sale.cashReceived)}</span></div>
          {sale.cashReceived > t.grandTotal && (
            <div className="flex justify-between"><span>Returned</span><span>{formatINR(sale.cashReceived - t.grandTotal)}</span></div>
          )}
        </>
      )}
      {sale.dueAmount > 0 && (
        <>
          <div className="flex justify-between"><span>Paid now</span><span>{formatINR(sale.amountPaid)}</span></div>
          <div className="flex justify-between font-bold"><span>Balance due</span><span>{formatINR(sale.dueAmount)}</span></div>
        </>
      )}

      <div className="mt-2 text-center">Thank you! Visit again.</div>
    </div>
  );
}
