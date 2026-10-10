"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { UserRound, ChevronDown, Plus, X, Check } from "lucide-react";

const KEY = "pos.accounts"; // remembered owner emails on THIS device (no passwords stored)

function loadEmails(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function saveEmail(email: string) {
  const e = email.trim().toLowerCase();
  if (!e) return;
  const list = loadEmails().filter((x) => x !== e);
  list.unshift(e);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8)));
}

/** Owner-only account switcher. Lists remembered logins; switching re-enters the
 *  password (via signIn) — passwords are never stored, only the email for convenience. */
export function AccountSwitcher({ currentEmail }: { currentEmail: string }) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [pwFor, setPwFor] = useState<string | null>(null); // email we're entering a password for ("" = add new)
  const [pw, setPw] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentEmail) saveEmail(currentEmail);
    setEmails(loadEmails());
  }, [currentEmail]);

  // close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (boxRef.current && !boxRef.current.contains(e.target as Node)) { setOpen(false); setPwFor(null); } }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function doSwitch(email: string, password: string) {
    setBusy(true); setErr("");
    const res = await signIn("credentials", { email: email.trim().toLowerCase(), password, redirect: false });
    setBusy(false);
    if (res?.error) return setErr("Wrong email or password");
    saveEmail(email);
    window.location.href = "/dashboard"; // full reload so the new shop/session loads everywhere
  }

  const others = emails.filter((e) => e !== currentEmail.trim().toLowerCase());

  return (
    <div ref={boxRef} className="relative">
      <button type="button" onClick={() => { setOpen((s) => !s); setPwFor(null); setErr(""); }}
        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-brand-200 hover:bg-brand-50">
        <UserRound size={16} className="text-gray-400" />
        <span className="hidden max-w-[160px] truncate sm:inline">{currentEmail || "Account"}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-soft">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Signed in as</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm font-semibold text-gray-800">
              <Check size={14} className="text-emerald-500" /> {currentEmail}
            </p>
          </div>

          {/* password prompt (switch or add) */}
          {pwFor !== null ? (
            <form className="flex flex-col gap-2 p-4" onSubmit={(e) => { e.preventDefault(); doSwitch(pwFor || addEmail, pw); }}>
              <p className="text-xs text-gray-500">Enter password for</p>
              <p className="truncate text-sm font-medium text-gray-800">{pwFor || addEmail || "the account"}</p>
              {pwFor === "" && (
                <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} type="email" required placeholder="email@shop.in"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              )}
              <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" required autoFocus placeholder="Password"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              {err && <p className="text-xs text-red-600">{err}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setPwFor(null); setPw(""); setErr(""); }} className="rounded-lg border px-3 py-1.5 text-sm">Cancel</button>
                <button disabled={busy} className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                  {busy ? "Switching…" : "Switch"}
                </button>
              </div>
            </form>
          ) : (
            <div className="py-1">
              {others.length > 0 && <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Switch to</p>}
              {others.map((e) => (
                <button key={e} onClick={() => { setPwFor(e); setPw(""); setErr(""); }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50">
                  <UserRound size={15} className="text-gray-400" /> <span className="truncate">{e}</span>
                </button>
              ))}
              <button onClick={() => { setPwFor(""); setAddEmail(""); setPw(""); setErr(""); }}
                className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-left text-sm font-medium text-brand-700 hover:bg-brand-50">
                <Plus size={15} /> Add another account
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
