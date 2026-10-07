import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import type { Ctx, Role } from "./session";

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
  };
});
