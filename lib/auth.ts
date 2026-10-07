import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { connectDB } from "./db";
import { UserModel } from "@/models/User";
import { BusinessMemberModel } from "@/models/BusinessMember";
import { verifyPassword } from "./password";
import { loginSchema } from "@/schemas/auth";

/** Resolve the user's active business + role (first membership for V1). */
async function activeMembership(userId: string) {
  // Must ensure the connection: the jwt callback runs on session reads where
  // authorize() (which connects) did not run, else the query buffers and times out.
  await connectDB();
  const m = await BusinessMemberModel.findOne({ userId }).lean<{
    businessId: { toString(): string };
    role: string;
  }>();
  if (!m) return { businessId: null, role: null };
  return { businessId: m.businessId.toString(), role: m.role };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        await connectDB();
        const user = await UserModel.findOne({ email });
        if (!user) return null;

        // NOTE: login lockout is intentionally disabled for now. The failedLogins/
        // lockedUntil fields remain on the model so it can be re-enabled later.
        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return { id: user._id.toString(), name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user?.id) token.userId = user.id;
      const uid = (token.userId as string) ?? user?.id;
      // Attach tenant claims on sign-in, on explicit update, or while still missing
      // (the latter picks up a business created during onboarding on the next request).
      if (uid && (user?.id || trigger === "update" || !token.businessId)) {
        const { businessId, role } = await activeMembership(uid);
        token.businessId = businessId;
        token.role = role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.businessId = (token.businessId as string | null) ?? null;
      session.user.role = (token.role as string | null) ?? null;
      return session;
    },
  },
});
