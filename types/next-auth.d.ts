import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      businessId: string | null;
      role: string | null;
      permissions?: Record<string, string> | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    businessId?: string | null;
    role?: string | null;
    permissions?: Record<string, string> | null;
  }
}
