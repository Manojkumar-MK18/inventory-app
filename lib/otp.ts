/**
 * DUMMY OTP (development / demo only).
 *
 * There is no SMS gateway yet. To keep testing simple, the valid OTP for any
 * mobile number is just its FIRST 6 DIGITS. e.g. mobile 98765 43210 -> OTP 987654.
 *
 * Replace expectedOtp() with a real OTP service (send + verify) before going live.
 */

/** Keep only digits from whatever the user typed. */
export function digitsOnly(mobile: string): string {
  return (mobile || "").replace(/\D/g, "");
}

/** A 10-digit Indian mobile number. */
export function isValidMobile(mobile: string): boolean {
  const d = digitsOnly(mobile);
  return d.length === 10 && /^[6-9]/.test(d);
}

/** The dummy OTP = the first 6 digits of the mobile number. */
export function expectedOtp(mobile: string): string {
  return digitsOnly(mobile).slice(0, 6);
}

/** True when the entered OTP matches the dummy rule. */
export function verifyOtp(mobile: string, entered: string): boolean {
  const code = digitsOnly(entered);
  return code.length === 6 && code === expectedOtp(mobile);
}
