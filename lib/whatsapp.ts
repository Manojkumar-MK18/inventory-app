import { formatINR } from "./money";
import type { SavedSale } from "@/actions/sales";

/** Normalise an Indian phone to wa.me form: digits only, 10-digit numbers get 91 prefix. */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  return null;
}

/** Paise -> "650.00" (plain, no ₹) for the aligned monospace table. */
function num(paise: number): string {
  return (paise / 100).toFixed(2);
}

/** Shop details shown in the bill footer. Only `name` is required. */
export interface ShopInfo {
  name: string;
  address?: string;
  phone?: string;
  instagram?: string;
  mapsUrl?: string;
}

/**
 * Warm, retail-style bill for WhatsApp (text only — no file).
 * Items go in a ``` monospace block so columns line up as a real table.
 */
export function billMessage(sale: SavedSale, shop: ShopInfo | string): string {
  // Backward compatible: accept just a name string or a full shop object.
  const s: ShopInfo = typeof shop === "string" ? { name: shop } : shop;

  const date = new Date(sale.date).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  // The whole receipt BODY goes in ONE monospace block (width 32, like a thermal
  // printer) so every column, colon and amount lines up neatly on all phones.
  const WIDTH = 32;
  const rupee = (p: number) => "₹" + num(p); // ₹ is a single cell in monospace
  const center = (x: string) => {
    const pad = Math.max(0, Math.floor((WIDTH - x.length) / 2));
    return " ".repeat(pad) + x;
  };
  const rule = "-".repeat(WIDTH);
  const lr = (l: string, r: string) => l + r.padStart(Math.max(1, WIDTH - l.length)); // label left, value right

  // Item columns: Name | Qty | Rate | Amount  (3 + 5 + 8 + widths fit WIDTH)
  const C = { name: 12, qty: 4, rate: 7, amt: 9 };
  const clip = (x: string) => (x.length > C.name ? x.slice(0, C.name - 1) + "." : x);
  const itemHead =
    "Item".padEnd(C.name) + "Qty".padStart(C.qty) + "Rate".padStart(C.rate) + "Amt".padStart(C.amt);
  const itemRows = sale.items.map((i) => {
    const amt = i.taxable + i.cgst + i.sgst + i.igst;
    return (
      clip(i.name).padEnd(C.name) +
      String(i.qty).padStart(C.qty) +
      num(i.price).padStart(C.rate) +
      num(amt).padStart(C.amt)
    );
  });

  const t = sale.totals;
  const gross = sale.items.reduce((a, i) => a + i.price * i.qty, 0);
  const totalDiscount = sale.items.reduce((a, i) => a + (i.discount || 0), 0);

  const body: string[] = [
    center(s.name.toUpperCase()),
    center("Thank you for shopping!"),
    rule,
    lr("Invoice:", sale.invoiceNo),
    lr("Date:", date),
    ...(sale.billedBy ? [lr("Billed by:", sale.billedBy)] : []),
    rule,
    itemHead,
    rule,
    ...itemRows,
    rule,
    lr("Items total", rupee(gross)),
  ];
  if (totalDiscount > 0) body.push(lr("Discount", "-" + rupee(totalDiscount)));
  if (sale.billDiscount > 0) body.push(lr("Bill discount", "-" + rupee(sale.billDiscount)));
  if (t.cgst + t.sgst > 0) { body.push(lr("CGST", rupee(t.cgst))); body.push(lr("SGST", rupee(t.sgst))); }
  if (t.igst > 0) body.push(lr("IGST", rupee(t.igst)));
  if (sale.roundOff !== 0) body.push(lr("Round off", rupee(sale.roundOff)));
  body.push(rule, lr("TOTAL", rupee(t.grandTotal)));
  if (sale.dueAmount > 0) {
    body.push(lr("Paid now", rupee(sale.amountPaid)));
    body.push(lr("Balance due", rupee(sale.dueAmount)));
  }
  body.push(rule, center("We hope to see you again!"));

  const receipt = "```\n" + body.join("\n") + "\n```";

  // Store details go OUTSIDE the code block so the Maps / Instagram links stay
  // blue and tappable (links inside ``` are not clickable on WhatsApp).
  const footer: string[] = [`*${s.name.toUpperCase()}*`];
  if (s.address) footer.push(s.address);
  if (s.phone) footer.push(`Phone: ${s.phone}`);
  if (s.mapsUrl) footer.push(`Google Maps: ${s.mapsUrl}`);
  if (s.instagram) footer.push(`Instagram: ${s.instagram}`);

  return [receipt, ``, ...footer].join("\n");
}

/** wa.me link that opens a chat with this number and the message prefilled. */
export function whatsappUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
