"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PasswordInput } from "@/components/PasswordInput";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const justCreated = params.get("created") === "1";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Wrong email or password.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Sign in</h1>
      {justCreated && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Your shop is set up. Sign in to start.
        </p>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input name="email" type="email" required placeholder="Email"
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm" />
        <PasswordInput name="password" required placeholder="Password" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading}
          className="rounded-lg bg-black py-2.5 text-sm font-medium text-white disabled:opacity-50">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="flex justify-between text-sm text-gray-500">
        <Link href="/register" className="font-medium text-gray-700 hover:underline">Create account</Link>
        <Link href="/reset-password" className="hover:underline">Forgot password?</Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
