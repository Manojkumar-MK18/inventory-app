"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { CalendarDays, LogIn, LogOut, Power } from "lucide-react";
import { checkIn, checkOut, type TodayStatus } from "@/actions/attendance";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { useToast } from "@/components/ui/Toast";

function fmtTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function AppHeader({ status, today, role, currentEmail }: { status: TodayStatus; today: string; role?: string; currentEmail?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok && "error" in res) toast.error(res.error ?? "Something went wrong");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200/80 bg-white/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-2.5 rounded-full bg-gray-50 px-3.5 py-1.5 text-sm font-semibold text-gray-600">
        <CalendarDays size={17} className="text-brand-500" />
        {today}
      </div>

      <div className="flex items-center gap-2.5">
        {status.open ? (
          <button onClick={() => act(checkOut)} disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-all hover:bg-gray-800 hover:shadow-soft disabled:opacity-50">
            <LogOut size={17} /> Check out
            <span className="ml-1 border-l border-white/20 pl-2 text-xs font-medium text-gray-300">in at {fmtTime(status.lastInTime)}</span>
          </button>
        ) : (
          <button onClick={() => act(checkIn)} disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-all hover:bg-emerald-700 hover:shadow-soft disabled:opacity-50">
            <LogIn size={17} /> Check in
          </button>
        )}
        {status.sessions > 0 && (
          <span className="hidden rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500 sm:inline">
            {status.sessions} session{status.sessions > 1 ? "s" : ""} today
          </span>
        )}

        {role === "OWNER" && <AccountSwitcher currentEmail={currentEmail ?? ""} />}

        <span className="mx-0.5 h-6 w-px bg-gray-200" />

        <Link href="/attendance" title="Attendance calendar"
          className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-brand-50 hover:text-brand-600">
          <CalendarDays size={20} />
        </Link>

        <button onClick={() => signOut({ callbackUrl: "/login" })} title="Sign out"
          className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600">
          <Power size={20} />
        </button>
      </div>
    </header>
  );
}
