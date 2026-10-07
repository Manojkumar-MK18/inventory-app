import bcrypt from "bcryptjs";
import crypto from "node:crypto";

export const BCRYPT_COST = 12;
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
export const RESET_TOKEN_MINUTES = 30;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** A reset token: return the raw token (emailed) and its hash (stored). */
export function makeResetToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = hashToken(raw);
  return { raw, hash };
}

/** Deterministic hash for reset tokens (lookup by hash, never store the raw). */
export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function lockoutUntil(): Date {
  return new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
}

export function resetExpiry(): Date {
  return new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);
}
