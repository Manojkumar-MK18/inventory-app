"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { User as UserIcon, Lock, Eye, EyeOff, CheckCircle2, ArrowRight } from "lucide-react";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { isValidLoginId } from "@/lib/validate";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const justCreated = params.get("created") === "1";

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [idError, setIdError] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIdError("");

    // Validate before hitting the server.
    if (!isValidLoginId(loginId)) {
      setIdError("Enter a valid email or 10-digit mobile");
      return;
    }
    if (!password) {
      setError("Enter your password");
      return;
    }

    setLoading(true);
    const res = await signIn("credentials", {
      loginId: loginId.trim(),
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Wrong mobile/email or password.");
      toast.error("Wrong mobile/email or password.");
      return;
    }
    toast.success("Welcome back!");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Sign in</h1>
        <p className="mt-1 text-sm text-gray-500">Use your mobile number or email.</p>
      </div>

      {justCreated && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Your shop is set up. Sign in to start.
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          label="Mobile or email"
          startIcon={<UserIcon className="h-4 w-4" />}
          value={loginId}
          onChange={(e) => {
            setLoginId(e.target.value);
            if (idError) setIdError("");
          }}
          error={idError}
          autoFocus
        />
        <TextField
          label="Password"
          type={showPw ? "text" : "password"}
          startIcon={<Lock className="h-4 w-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
          endAdornment={
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <div className="flex justify-end">
          <Link href="/reset-password" className="text-sm text-brand-700 hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" loading={loading} fullWidth>
          {loading ? "Signing in…" : "Sign in"} {!loading && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>

      <Link href="/register" className="text-center text-sm text-gray-500 hover:underline">
        New here? <span className="font-semibold text-gray-700">Create a shop</span>
      </Link>
    </div>
  );
}
