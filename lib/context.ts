import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import type { Ctx, Role } from "./session";
import { can, firstAllowedHref } from "./permissions";

/**
 * The server-side tenant context. Reads the Auth.js session — businessId and role
 * come ONLY from here, never from client input.
 *
 * Wrapped in React cache() so the layout and page share one auth() call per request
 * (no duplicate session/DB work on every navigation).
 *
 * - No session       -> redirect to /login
 * - No business yet  -> redirect to /onboarding (user must create a shop first)
 */
export const getContext = cache(async (): Promise<Ctx> => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.businessId || !session.user.role) redirect("/onboarding");

  return {
    userId: session.user.id,
    businessId: session.user.businessId,
    role: session.user.role as Role,
    permissions: (session.user.permissions ?? {}) as Ctx["permissions"],
  };
});

/** Like getContext but returns null instead of redirecting (for optional checks). */
export const tryGetContext = cache(async (): Promise<Ctx | null> => {
  const session = await auth();
  if (!session?.user?.id || !session.user.businessId || !session.user.role) return null;
  return {
    userId: session.user.id,
    businessId: session.user.businessId,
    role: session.user.role as Role,
    permissions: (session.user.permissions ?? {}) as Ctx["permissions"],
  };
});

/** Page guard: ensure the user can view this menu, else send them to their home page. */
export async function requireView(moduleKey: string): Promise<Ctx> {
  const ctx = await getContext();
  if (!can(ctx, moduleKey, "view")) redirect(firstAllowedHref(ctx));
  return ctx;
}

/** Page guard: owner-only pages (Settings). */
export async function requireOwner(): Promise<Ctx> {
  const ctx = await getContext();
  if (ctx.role !== "OWNER") redirect(firstAllowedHref(ctx));
  return ctx;
}
