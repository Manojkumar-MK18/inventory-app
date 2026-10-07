"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerUser } from "@/actions/auth";
import { PasswordInput } from "@/components/PasswordInput";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    const res = await registerUser({
      name: form.get("name"),
      email,
      password,
    });
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    // Auto sign-in, then on to onboarding (no business yet).
    await signIn("credentials", { email, password, redirect: false });
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Create account</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input name="name" required placeholder="Your name"
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm" />
        <input name="email" type="email" required placeholder="Email"
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm" />
        <PasswordInput name="password" required minLength={8}
          placeholder="Password (min 8 chars)" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading}
          className="rounded-lg bg-black py-2.5 text-sm font-medium text-white disabled:opacity-50">
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
      <Link href="/login" className="text-sm text-gray-500 hover:underline">
        Already have an account? <span className="font-medium text-gray-700">Sign in</span>
      </Link>
    </div>
  );
}
