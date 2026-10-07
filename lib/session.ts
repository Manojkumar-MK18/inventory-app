/**
 * The tenant context. businessId and role come ONLY from the server-side session,
 * never from client input. Every action/repository takes a Ctx.
 */
export type Role = "OWNER" | "MANAGER" | "CASHIER";

export interface Ctx {
  userId: string;
  businessId: string;
  role: Role;
}

/** Throw if the user's role is not in the allowed set. Call at the top of actions. */
export function requireRole(ctx: Ctx, allowed: Role[]): void {
  if (!allowed.includes(ctx.role)) {
    throw new Error(`Forbidden: role ${ctx.role} not allowed`);
  }
}
