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
  const { name, email, password, mobile } = parsed.data;

  // Server-side safety net for the (dummy) OTP: the mobile must have been
  // verified against its first 6 digits on the client.
  const { verifyOtp, digitsOnly } = await import("@/lib/otp");
  const sixDigits = digitsOnly(mobile).slice(0, 6);
  if (!verifyOtp(mobile, sixDigits)) return { ok: false, error: "Mobile is not verified" };

  await connectDB();
  const exists = await UserModel.findOne({ $or: [{ email }, { mobile }] });
  if (exists) {
    return {
      ok: false,
      error:
        exists.email === email
          ? "An account with this email already exists"
          : "An account with this mobile already exists",
    };
  }

  const passwordHash = await hashPassword(password);
  await UserModel.create({
    name,
    email,
    mobile,
    passwordHash,
    mobileVerifiedAt: new Date(),
    termsAcceptedAt: new Date(),
  });
  return { ok: true };
}

/**
 * Register the owner AND create their shop in one call, BEFORE sign-in.
 * Doing both here (instead of signing in then calling createBusiness) avoids the
 * middleware redirecting the second server action away from the /register page.
 */
export async function registerOwnerAndShop(raw: {
  owner: unknown;
  shop: unknown;
}): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const owner = registerSchema.safeParse(raw.owner);
  if (!owner.success) return { ok: false, error: "Please check the owner details" };
  const shop = createBusinessSchema.safeParse(raw.shop);
  if (!shop.success) return { ok: false, error: "Please check the shop details" };

  const { name, email, password, mobile } = owner.data;

  // Server-side safety net for the (dummy) OTP.
  const { verifyOtp, digitsOnly } = await import("@/lib/otp");
  if (!verifyOtp(mobile, digitsOnly(mobile).slice(0, 6))) {
    return { ok: false, error: "Mobile is not verified" };
  }

  await connectDB();
  const exists = await UserModel.findOne({ $or: [{ email }, { mobile }] });
  if (exists) {
    return {
      ok: false,
      error:
        exists.email === email
          ? "An account with this email already exists"
          : "An account with this mobile already exists",
    };
  }

  const passwordHash = await hashPassword(password);
  const user = await UserModel.create({
    name,
    email,
    mobile,
    passwordHash,
    mobileVerifiedAt: new Date(),
    termsAcceptedAt: new Date(),
  });

  const s = shop.data;
  const stateCode =
    s.gstin && s.gstin.length === 15 ? s.gstin.slice(0, 2) : s.stateCode || null;

  try {
    const business = await BusinessModel.create({
      name: s.name,
      gstType: s.gstType,
      gstin: s.gstin || null,
      stateCode,
      address: s.address || "",
      phone: s.phone || "",
      pricesIncludeTax: s.pricesIncludeTax,
      mapsUrl: s.mapsUrl || "",
      lat: s.lat ?? null,
      lng: s.lng ?? null,
    });
    await BusinessMemberModel.create({
      businessId: business._id,
      userId: user._id,
      role: "OWNER",
    });
  } catch (e) {
    // Roll back the user so a retry isn't blocked by a half-made account.
    await UserModel.deleteOne({ _id: user._id });
    return { ok: false, error: "Could not create the shop — please try again" };
  }

  return { ok: true, email };
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
    mapsUrl: data.mapsUrl || "",
    lat: data.lat ?? null,
    lng: data.lng ?? null,
  });

  await BusinessMemberModel.create({
    businessId: business._id,
    userId: session.user.id,
    role: "OWNER",
  });

  // The caller (register wizard or onboarding form) redirects to /dashboard;
  // the jwt callback picks up this new membership on the next request.
  return { ok: true };
}

/** Helper for UI to know if the signed-in user still needs onboarding. */
export async function needsOnboarding(): Promise<boolean> {
  return (await tryGetContext()) === null;
}

export type OwnerProfile = { name: string; email: string; mobile: string };

/** The signed-in user's own profile (for the onboarding owner card). */
export async function getOwnerProfile(): Promise<OwnerProfile | null> {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user?.id) return null;

  await connectDB();
  const u = await UserModel.findById(session.user.id).lean<{
    name: string;
    email: string;
    mobile?: string;
  }>();
  if (!u) return null;
  return { name: u.name, email: u.email, mobile: u.mobile ?? "" };
}

/** Update the signed-in user's own name / mobile. */
export async function updateOwnerProfile(raw: {
  name?: unknown;
  mobile?: unknown;
}): Promise<ActionResult> {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in" };

  const name = String(raw.name ?? "").trim();
  const mobile = String(raw.mobile ?? "").replace(/\D/g, "");
  if (name.length < 2) return { ok: false, error: "Enter a valid name" };
  if (!/^[6-9]\d{9}$/.test(mobile)) return { ok: false, error: "Enter a valid 10-digit mobile" };

  await connectDB();
  // Mobile must stay unique across users.
  const clash = await UserModel.findOne({ mobile, _id: { $ne: session.user.id } });
  if (clash) return { ok: false, error: "That mobile is used by another account" };

  await UserModel.updateOne({ _id: session.user.id }, { $set: { name, mobile } });
  return { ok: true };
}

/**
 * Delete the signed-in user's own account. Only allowed while the user has no
 * shop yet (the onboarding state) — so there is no shop data to lose.
 */
export async function deleteOwnerAccount(): Promise<ActionResult> {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in" };

  await connectDB();
  const membership = await BusinessMemberModel.findOne({ userId: session.user.id });
  if (membership) {
    return { ok: false, error: "This account already owns a shop and cannot be deleted here" };
  }

  await UserModel.deleteOne({ _id: session.user.id });
  return { ok: true };
}
