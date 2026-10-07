"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { createBusiness } from "@/actions/auth";

export function OnboardingForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const f = new FormData(e.currentTarget);
    const res = await createBusiness({
      name: f.get("name"),
      gstType: f.get("gstType"),
      gstin: f.get("gstin") || "",
      stateCode: f.get("stateCode") || "",
      address: f.get("address") || "",
      phone: f.get("phone") || "",
      pricesIncludeTax: f.get("pricesIncludeTax") === "on",
    });
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    // Shop created. Sign out so the user logs in explicitly, then enters the app.
    await signOut({ callbackUrl: "/login?created=1" });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input name="name" required placeholder="Shop name"
        className="rounded border px-3 py-2" />

      <select name="gstType" className="rounded border px-3 py-2" defaultValue="UNREGISTERED">
        <option value="UNREGISTERED">Unregistered (no GST)</option>
        <option value="COMPOSITION">Composition (Bill of Supply)</option>
        <option value="REGULAR">Regular (Tax Invoice with GST)</option>
      </select>

      <input name="gstin" placeholder="GSTIN (15 chars, if registered)" maxLength={15}
        className="rounded border px-3 py-2" />
      <input name="stateCode" placeholder="State code (2 digits, if no GSTIN)" maxLength={2}
        className="rounded border px-3 py-2" />
      <input name="phone" placeholder="Shop phone" className="rounded border px-3 py-2" />
      <textarea name="address" placeholder="Address" rows={2}
        className="rounded border px-3 py-2" />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="pricesIncludeTax" defaultChecked />
        Prices include tax (typical for retail)
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={loading}
        className="rounded bg-black py-2 text-white disabled:opacity-50">
        {loading ? "Creating…" : "Create shop & continue"}
      </button>
    </form>
  );
}
