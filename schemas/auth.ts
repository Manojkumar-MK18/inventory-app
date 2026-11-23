import { z } from "zod";

export const loginSchema = z.object({
  // Accepts an email OR a 10-digit mobile number.
  loginId: z.string().min(3).max(254),
  password: z.string().min(8).max(100),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(254),
  password: z.string().min(8).max(100),
  // 10-digit Indian mobile, verified by the (dummy) OTP on the client.
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile"),
  mobileVerified: z.boolean().optional(),
  termsAccepted: z.boolean().optional(),
});

export const requestResetSchema = z.object({
  email: z.string().email().max(254),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8).max(100),
});

export const createBusinessSchema = z.object({
  name: z.string().min(2).max(200),
  gstType: z.enum(["REGULAR", "COMPOSITION", "UNREGISTERED"]),
  gstin: z.string().length(15).optional().or(z.literal("")),
  stateCode: z.string().length(2).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  pricesIncludeTax: z.boolean().default(true),
  // Optional shop location from the map picker.
  mapsUrl: z.string().max(400).optional().or(z.literal("")),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
