/**
 * Indian financial year runs April (month 4) to March. FY must be computed from
 * the IST date, never UTC — otherwise early April / late March bills get the wrong year.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Return the Date shifted into IST wall-clock (its UTC fields now read as IST). */
export function toIST(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

/** Financial-year label for a date, e.g. "2026-27". */
export function financialYear(date: Date): string {
  const ist = toIST(date);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth() + 1; // 1-12
  const startYear = month >= 4 ? year : year - 1;
  const endShort = ((startYear + 1) % 100).toString().padStart(2, "0");
  return `${startYear}-${endShort}`;
}
