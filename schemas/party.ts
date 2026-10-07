import { z } from "zod";

/** Shared schema for customers and suppliers (parties). */
export const partyFormSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(20).optional().or(z.literal("")),
  area: z.string().max(120).optional().or(z.literal("")),
});

export const partyUpdateSchema = partyFormSchema.extend({ id: z.string().length(24) });

export const settleDueSchema = z.object({
  id: z.string().length(24),
  amountRupees: z.coerce.number().positive().max(10_000_000),
  method: z.enum(["CASH", "UPI", "CARD"]).default("CASH"),
});

export type PartyFormInput = z.infer<typeof partyFormSchema>;
