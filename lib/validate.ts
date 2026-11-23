/** Small shared validators for forms (client + server safe). */

// Pragmatic email check: something@something.tld, no spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test((value || "").trim());
}

/** 10-digit Indian mobile starting 6-9. */
export function isValidMobile(value: string): boolean {
  const d = (value || "").replace(/\D/g, "");
  return d.length === 10 && /^[6-9]/.test(d);
}

/** A login id is valid if it is EITHER an email OR a 10-digit mobile. */
export function isValidLoginId(value: string): boolean {
  return isValidEmail(value) || isValidMobile(value);
}

/** 15-char GSTIN: 2 state digits + 10-char PAN + entity + Z + checksum char. */
export function isValidGstin(value: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test((value || "").toUpperCase().trim());
}

/** 6-digit Indian pincode. */
export function isValidPincode(value: string): boolean {
  return /^[1-9][0-9]{5}$/.test((value || "").trim());
}
