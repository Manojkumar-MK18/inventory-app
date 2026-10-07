/**
 * In-store barcode helpers. We generate valid EAN-13 codes using the "20"
 * in-store prefix (GS1 reserves 20–29 for retailer internal use), so they are
 * standard, scannable everywhere, and won't clash with real manufacturer codes.
 */

/** EAN-13 check digit for the first 12 digits. */
export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = first12.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/** A random valid 13-digit EAN-13 with the in-store "20" prefix. */
export function makeEan13(rand: () => number = Math.random): string {
  let body = "20";
  for (let i = 0; i < 10; i++) body += Math.floor(rand() * 10);
  return body + ean13CheckDigit(body);
}

/** True if a string is a valid 13-digit EAN-13 (right length + check digit). */
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return ean13CheckDigit(code.slice(0, 12)) === code.charCodeAt(12) - 48;
}
