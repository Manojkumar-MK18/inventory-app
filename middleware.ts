import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge-safe auth (no DB/bcrypt) — just validates the JWT and runs `authorized`.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Protect everything except static assets, the auth API, and Next internals.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
