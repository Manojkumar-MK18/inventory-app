import { Schema, model, models } from "mongoose";

/**
 * Users are GLOBAL (not tenant-scoped) — one person can own/work in several shops.
 * No tenant plugin here. Tenancy is expressed via BusinessMember.
 */
const userSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, maxlength: 120 },

    // Login lockout (stored in DB — functions keep no memory between requests).
    failedLogins: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },

    // Password reset: token is hashed, single-use, short-lived.
    resetTokenHash: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });

export const UserModel = models.User || model("User", userSchema);
