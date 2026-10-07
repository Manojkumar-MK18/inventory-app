import { describe, it, expect } from "vitest";
import { computeBill } from "@/lib/tax";
import { formatINR, toPaise } from "@/lib/money";
import { financialYear } from "@/lib/fy";

describe("GST engine", () => {
  it("inclusive 5%, intra-state: ₹525 shirt -> taxable ₹500, CGST+SGST ₹12.50 each", () => {
    const bill = computeBill([{ price: toPaise(525), qty: 1, taxRate: 5 }], {
      gstType: "REGULAR",
      pricesIncludeTax: true,
      interState: false,
    });
    expect(bill.taxable).toBe(50000);
    expect(bill.cgst).toBe(1250);
    expect(bill.sgst).toBe(1250);
    expect(bill.igst).toBe(0);
    expect(bill.grandTotal).toBe(52500);
  });

  it("inter-state uses IGST, not CGST/SGST", () => {
    const bill = computeBill([{ price: toPaise(1180), qty: 1, taxRate: 18 }], {
      gstType: "REGULAR",
      pricesIncludeTax: true,
      interState: true,
    });
    expect(bill.taxable).toBe(100000);
    expect(bill.igst).toBe(18000);
    expect(bill.cgst).toBe(0);
  });

  it("exclusive pricing adds tax on top", () => {
    const bill = computeBill([{ price: toPaise(100), qty: 2, taxRate: 18 }], {
      gstType: "REGULAR",
      pricesIncludeTax: false,
      interState: false,
    });
    expect(bill.taxable).toBe(20000);
    expect(bill.cgst + bill.sgst).toBe(3600);
  });

  it("composition charges no GST", () => {
    const bill = computeBill([{ price: toPaise(525), qty: 1, taxRate: 5 }], {
      gstType: "COMPOSITION",
      pricesIncludeTax: true,
      interState: false,
    });
    expect(bill.cgst).toBe(0);
    expect(bill.taxable).toBe(52500);
  });

  it("a discount larger than the price clamps to zero (never negative)", () => {
    const bill = computeBill([{ price: toPaise(500), qty: 1, discount: toPaise(900), taxRate: 5 }], {
      gstType: "REGULAR",
      pricesIncludeTax: true,
      interState: false,
    });
    expect(bill.taxable).toBe(0);
    expect(bill.grandTotal).toBe(0);
    expect(bill.cgst).toBe(0);
  });

  it("discount is applied before tax", () => {
    const bill = computeBill([{ price: toPaise(100), qty: 1, discount: toPaise(20), taxRate: 18 }], {
      gstType: "REGULAR",
      pricesIncludeTax: false,
      interState: false,
    });
    expect(bill.taxable).toBe(8000); // 80 rupees
  });
});

describe("money helpers", () => {
  it("formats paise as INR with Indian grouping", () => {
    expect(formatINR(1234567)).toBe("₹12,345.67");
    expect(formatINR(52500)).toBe("₹525.00");
  });
  it("avoids float errors (0.1 + 0.2)", () => {
    expect(toPaise(0.1) + toPaise(0.2)).toBe(30);
  });
});

describe("financial year (IST)", () => {
  it("1 April is the new FY", () => {
    // 2026-03-31T20:00Z == 2026-04-01 01:30 IST
    expect(financialYear(new Date("2026-03-31T20:00:00Z"))).toBe("2026-27");
  });
  it("late March is still the old FY", () => {
    expect(financialYear(new Date("2026-03-30T10:00:00Z"))).toBe("2025-26");
  });
});
