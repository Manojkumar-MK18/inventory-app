/**
 * Money is ALWAYS stored and computed as integer paise. Never use floats for money.
 * 1 rupee = 100 paise. ₹525.00 is stored as 52500.
 */

/** Convert a rupee amount (number or "525.50" string) to integer paise. */
export function toPaise(rupees: number | string): number {
  const n = typeof rupees === "string" ? parseFloat(rupees) : rupees;
  if (!Number.isFinite(n)) throw new Error(`toPaise: invalid amount ${rupees}`);
  return Math.round(n * 100);
}

/** Convert integer paise back to a rupee number (for display math only). */
export function toRupees(paise: number): number {
  return paise / 100;
}

/** Format integer paise as an Indian-rupee string, e.g. 52500 -> "₹525.00". */
export function formatINR(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const p = (abs % 100).toString().padStart(2, "0");
  // Indian digit grouping: 12,34,567
  const grouped = rupees.toLocaleString("en-IN");
  return `${sign}₹${grouped}.${p}`;
}

/** Round a paise amount to the nearest whole rupee (half up). Returns paise. */
export function roundToRupeePaise(paise: number): number {
  return Math.round(paise / 100) * 100;
}

/** Round-off delta needed to reach the nearest rupee. Positive = added, negative = subtracted. */
export function roundOffPaise(paise: number): number {
  return roundToRupeePaise(paise) - paise;
}
