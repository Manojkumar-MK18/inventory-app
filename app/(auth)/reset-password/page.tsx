"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { requestPasswordReset, resetPassword } from "@/actions/auth";
import { PasswordInput } from "@/components/PasswordInput";

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 2: a token is present -> set a new password.
  async function onReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await resetPassword({ token, password: form.get("password") });
    setLoading(false);
    if (!res.ok) return setError(res.error);
    router.push("/login");
  }

  // Step 1: no token -> request a reset email.
  async function onRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    await requestPasswordReset({ email: form.get("email") });
    setLoading(false);
    setMsg("If that email has an account, a reset link is on its way.");
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        {token ? "Set a new password" : "Reset password"}
      </h1>

      {token ? (
        <form onSubmit={onReset} className="flex flex-col gap-3">
          <PasswordInput name="password" required minLength={8}
            placeholder="New password (min 8 chars)" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={loading}
            className="rounded-lg bg-black py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {loading ? "Saving…" : "Save new password"}
          </button>
        </form>
      ) : (
        <form onSubmit={onRequest} className="flex flex-col gap-3">
          <input name="email" type="email" required placeholder="Your email"
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm" />
          {msg && <p className="text-sm text-green-700">{msg}</p>}
          <button disabled={loading}
            className="rounded-lg bg-black py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <Link href="/login" className="text-sm text-gray-500 hover:underline">Back to sign in</Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetInner />
    </Suspense>
  );
}
