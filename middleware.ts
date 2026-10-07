import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge-safe auth (no DB/bcrypt) — just validates the JWT and runs `authorized`.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Protect everything except static assets, the auth API, Next internals, and the
  // wireless-scanner surface (the phone scanner page + its API are used without login;
  // they are guarded by a short-lived pairing code instead).
  matcher: ["/((?!api/auth|api/scan|scanner|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
