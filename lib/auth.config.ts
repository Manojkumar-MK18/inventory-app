import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe config: NO mongoose, NO bcrypt here. Used by middleware to protect
 * routes. The heavy Credentials provider + DB callbacks live in lib/auth.ts.
 */
export const authConfig = {
  // Self-hosted (not on Vercel): trust the host so auth works on localhost / the shop PC.
  // Without this, NextAuth v5 rejects the request with an UntrustedHost error (/api/auth/error).
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // added in lib/auth.ts
  callbacks: {
    /** Route guard for middleware. Protected app pages require a session. */
    authorized({ auth, request: { nextUrl } }) {
      const loggedIn = !!auth?.user;
      const isAuthPage =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/register") ||
        nextUrl.pathname.startsWith("/reset-password");

      if (isAuthPage) {
        if (loggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }
      // Everything else under the matcher is protected.
      return loggedIn;
    },
  },
} satisfies NextAuthConfig;
