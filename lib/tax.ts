/**
 * GST engine. All amounts in integer paise. Rounding rule: round tax PER LINE (half up),
 * then round the bill total to the nearest rupee with a round-off line.
 *
 * Intra-state (same state as shop, or walk-in with no state) -> CGST + SGST (half each).
 * Inter-state -> IGST (full rate).
 */

import { roundOffPaise, roundToRupeePaise } from "./money";

export type GstType = "REGULAR" | "COMPOSITION" | "UNREGISTERED";

export interface LineInput {
  /** Unit price in paise. If pricesIncludeTax, this is the tax-inclusive MRP. */
  price: number;
  qty: number; // integer, smallest unit (e.g. grams, or pieces)
  /** Per-unit discount in paise, applied before tax. */
  discount?: number;
  /** GST rate as a whole number percent, e.g. 5, 12, 18. */
  taxRate: number;
}

export interface LineResult {
  gross: number; // price * qty before discount
  discount: number; // total discount for the line
  taxable: number; // value GST is charged on (after discount)
  cgst: number;
  sgst: number;
  igst: number;
  total: number; // taxable + taxes, rounded per line
}

export interface BillResult {
  lines: LineResult[];
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundOff: number; // delta applied to reach nearest rupee
  grandTotal: number; // rounded to nearest rupee
}

export interface TaxContext {
  gstType: GstType;
  pricesIncludeTax: boolean;
  interState: boolean;
}

function roundHalfUp(n: number): number {
  return Math.round(n);
}

function computeLine(line: LineInput, ctx: TaxContext): LineResult {
  const gross = line.price * line.qty;
  // Clamp discount to the line value — a discount can never exceed the price,
  // so a line (and the bill) can never go negative from a fat-fingered discount.
  const discount = Math.min(gross, (line.discount ?? 0) * line.qty);
  const net = gross - discount; // what the customer pays for the line, incl tax if inclusive

  // Composition / unregistered businesses charge no GST on the document.
  const rate = ctx.gstType === "REGULAR" ? line.taxRate : 0;

  let taxable: number;
  let taxTotal: number;

  if (rate === 0) {
    taxable = net;
    taxTotal = 0;
  } else if (ctx.pricesIncludeTax) {
    // net is tax-inclusive: taxable = net * 100 / (100 + rate)
    taxable = roundHalfUp((net * 100) / (100 + rate));
    taxTotal = net - taxable;
  } else {
    taxable = net;
    taxTotal = roundHalfUp((net * rate) / 100);
  }

  let cgst = 0,
    sgst = 0,
    igst = 0;
  if (ctx.interState) {
    igst = taxTotal;
  } else {
    cgst = Math.floor(taxTotal / 2);
    sgst = taxTotal - cgst; // put the odd paisa on SGST so halves always sum exactly
  }

  const total = taxable + cgst + sgst + igst;
  return { gross, discount, taxable, cgst, sgst, igst, total };
}

export function computeBill(lines: LineInput[], ctx: TaxContext): BillResult {
  const results = lines.map((l) => computeLine(l, ctx));

  const sum = (f: (r: LineResult) => number) => results.reduce((a, r) => a + f(r), 0);
  const taxable = sum((r) => r.taxable);
  const cgst = sum((r) => r.cgst);
  const sgst = sum((r) => r.sgst);
  const igst = sum((r) => r.igst);
  const subtotal = taxable + cgst + sgst + igst;

  const grandTotal = roundToRupeePaise(subtotal);
  const roundOff = roundOffPaise(subtotal);

  return { lines: results, taxable, cgst, sgst, igst, roundOff, grandTotal };
}
