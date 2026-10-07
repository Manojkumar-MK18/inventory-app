import { describe, it, expect } from "vitest";
import { normalisePhone, billMessage, whatsappUrl } from "@/lib/whatsapp";

const sale = {
  invoiceNo: "INV/26-27/000001",
  date: new Date("2026-10-02T10:00:00Z").toISOString(),
  items: [
    { name: "Shirt", hsn: null, qty: 2, price: 52500, discount: 2000, taxRate: 5, taxable: 98000, cgst: 2450, sgst: 2450, igst: 0 },
  ],
  totals: { taxable: 98000, cgst: 2450, sgst: 2450, igst: 0, grandTotal: 102900 },
  roundOff: 0,
  billDiscount: 0,
  cashReceived: 0,
  amountPaid: 102900,
  dueAmount: 0,
  paymentMethod: "CASH",
  customerName: null,
  customerPhone: null,
  billedBy: null,
  status: "ISSUED",
};

describe("whatsapp phone normalisation", () => {
  it("10-digit gets 91 prefix", () => expect(normalisePhone("9876543210")).toBe("919876543210"));
  it("handles spaces and dashes", () => expect(normalisePhone("98765-43210")).toBe("919876543210"));
  it("accepts already-prefixed 91", () => expect(normalisePhone("919876543210")).toBe("919876543210"));
  it("strips leading 0", () => expect(normalisePhone("09876543210")).toBe("919876543210"));
  it("rejects too-short", () => expect(normalisePhone("12345")).toBeNull());
});

describe("whatsapp message + url", () => {
  it("message is a clean receipt: shop header, invoice, item, discount and total", () => {
    const m = billMessage(sale, "2k Shop");
    expect(m).toContain("2K SHOP"); // name is upper-cased in the header
    expect(m).toContain("Thank you for shopping!");
    expect(m).toContain("INV/26-27/000001");
    expect(m).toContain("Shirt");
    expect(m).toContain("-₹20.00"); // item discount line
    expect(m).toContain("₹1029.00"); // grand total (monospace, no thousands comma)
    expect(m).toContain("```"); // body is inside a monospace block
  });
  it("includes the shop footer: address, phone, instagram and maps", () => {
    const m = billMessage(sale, {
      name: "2K Outfits",
      address: "Idappadi, 637101",
      phone: "8220835102",
      instagram: "https://www.instagram.com/2k_outfits_idp",
      mapsUrl: "https://maps.app.goo.gl/xyz",
    });
    expect(m).toContain("Idappadi, 637101");
    expect(m).toContain("8220835102");
    expect(m).toContain("https://www.instagram.com/2k_outfits_idp");
    expect(m).toContain("https://maps.app.goo.gl/xyz");
  });
  it("shows balance due when the bill is part-paid", () => {
    const partial = { ...sale, amountPaid: 50000, dueAmount: 52900 };
    const m = billMessage(partial, "2k Shop");
    expect(m).toContain("Balance due");
    expect(m).toContain("₹529.00");
  });
  it("url encodes the message", () => {
    const url = whatsappUrl("919876543210", "hi there");
    expect(url).toBe("https://wa.me/919876543210?text=hi%20there");
  });
});
