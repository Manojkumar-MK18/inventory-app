"use server";

import { connectDB } from "@/lib/db";
import { UserModel } from "@/models/User";
import { BusinessModel } from "@/models/Business";
import { BusinessMemberModel } from "@/models/BusinessMember";
import {
  hashPassword,
  makeResetToken,
  hashToken,
  resetExpiry,
} from "@/lib/password";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { tryGetContext } from "@/lib/context";
import {
  registerSchema,
  requestResetSchema,
  resetPasswordSchema,
  createBusinessSchema,
} from "@/schemas/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Create a new user account. Does not log them in or create a business. */
export async function registerUser(raw: unknown): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid details" };
  const { name, email, password } = parsed.data;

  await connectDB();
  const exists = await UserModel.findOne({ email });
  if (exists) return { ok: false, error: "An account with this email already exists" };

  const passwordHash = await hashPassword(password);
  await UserModel.create({ name, email, passwordHash });
  return { ok: true };
}

/** Send a reset link. Always returns ok (don't reveal whether the email exists). */
export async function requestPasswordReset(raw: unknown): Promise<ActionResult> {
  const parsed = requestResetSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid email" };

  await connectDB();
  const user = await UserModel.findOne({ email: parsed.data.email });
  if (user) {
    const { raw: token, hash } = makeResetToken();
    user.resetTokenHash = hash;
    user.resetTokenExpiry = resetExpiry();
    await user.save();

    const base = process.env.AUTH_URL ?? "http://localhost:3000";
    await sendPasswordResetEmail(user.email, `${base}/reset-password?token=${token}`);
  }
  return { ok: true };
}

/** Consume a reset token and set a new password. Single-use. */
export async function resetPassword(raw: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { token, password } = parsed.data;

  await connectDB();
  const user = await UserModel.findOne({
    resetTokenHash: hashToken(token),
    resetTokenExpiry: { $gt: new Date() },
  });
  if (!user) return { ok: false, error: "This reset link is invalid or has expired" };

  user.passwordHash = await hashPassword(password);
  user.resetTokenHash = null;
  user.resetTokenExpiry = null;
  user.failedLogins = 0;
  user.lockedUntil = null;
  await user.save();
  return { ok: true };
}

/**
 * Onboarding: create a business and make the current user its OWNER.
 * Reads userId from the session, never from the form.
 */
export async function createBusiness(raw: unknown): Promise<ActionResult> {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in" };

  const parsed = createBusinessSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please fill the required fields" };
  const data = parsed.data;

  // Derive stateCode from GSTIN when present.
  const stateCode =
    data.gstin && data.gstin.length === 15 ? data.gstin.slice(0, 2) : data.stateCode || null;

  await connectDB();
  const business = await BusinessModel.create({
    name: data.name,
    gstType: data.gstType,
    gstin: data.gstin || null,
    stateCode,
    address: data.address || "",
    phone: data.phone || "",
    pricesIncludeTax: data.pricesIncludeTax,
  });

  await BusinessMemberModel.create({
    businessId: business._id,
    userId: session.user.id,
    role: "OWNER",
  });

  // Return success; the onboarding form signs the user out and sends them to
  // /login, so they sign in explicitly before entering the app.
  return { ok: true };
}

/** Helper for UI to know if the signed-in user still needs onboarding. */
export async function needsOnboarding(): Promise<boolean> {
  return (await tryGetContext()) === null;
}
