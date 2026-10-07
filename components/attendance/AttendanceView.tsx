"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { listAttendance, type AttendanceRow } from "@/actions/attendance";
import { downloadCsv } from "@/lib/csv";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
}
function fmtHours(mins: number) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function AttendanceView({ initialRows, year, month, weeklyOff }: { initialRows: AttendanceRow[]; year: number; month: number; weeklyOff: number }) {
  const [rows, setRows] = useState(initialRows);
  const [y, setY] = useState(year);
  const [m, setM] = useState(month);
  const [pending, start] = useTransition();

  const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  function go(delta: number) {
    let nm = m + delta, ny = y;
    if (nm < 1) { nm = 12; ny--; } else if (nm > 12) { nm = 1; ny++; }
    setY(ny); setM(nm);
    start(async () => setRows(await listAttendance(ny, nm)));
  }

  const selfByDay = useMemo(() => {
    const map = new Map<string, AttendanceRow>();
    rows.filter((r) => r.isSelf).forEach((r) => map.set(r.dayKey, r));
    return map;
  }, [rows]);

  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay();

  function exportCsv() {
    downloadCsv(
      `attendance-${y}-${pad(m)}.csv`,
      ["Date", "Worker", "First in", "Last out", "Sessions", "Hours", "Status"],
      rows.map((r) => [
        r.dayKey, r.userName, fmtTime(r.firstIn), fmtTime(r.lastOut),
        r.sessionCount, fmtHours(r.totalMinutes), r.status,
      ])
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => go(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-gray-100"><ChevronLeft size={16} /></button>
          <span className="w-40 text-center font-medium">{MONTHS[m - 1]} {y}</span>
          <button onClick={() => go(1)} className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-gray-100"><ChevronRight size={16} /></button>
          {pending && <span className="text-xs text-gray-400">loading…</span>}
        </div>
        <button onClick={exportCsv} disabled={rows.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Calendar — your own days */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">My calendar</h2>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {DOW.map((d) => <div key={d} className="py-1 font-medium text-gray-400">{d}</div>)}
          {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const key = `${y}-${pad(m)}-${pad(day)}`;
            const rec = selfByDay.get(key);
            const isFuture = key > todayKey;
            const isToday = key === todayKey;
            const dow = new Date(y, m - 1, day).getDay();
            const isWeeklyOff = dow === weeklyOff;
            let cls = "bg-gray-50 text-gray-300";
            let note = "";
            if (rec) { cls = "bg-green-50 text-green-700"; note = fmtHours(rec.totalMinutes); }
            else if (isWeeklyOff && !isFuture) { cls = "bg-gray-100 text-gray-400"; note = "Off"; }
            else if (!isFuture) { cls = "bg-red-50 text-red-500"; note = "Leave"; }
            return (
              <div key={key} className={`flex min-h-[48px] flex-col items-center justify-center rounded-lg ${cls} ${isToday ? "ring-2 ring-black" : ""}`}>
                <span className="text-sm font-medium">{day}</span>
                {note && <span className="text-[9px] leading-none">{note}</span>}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-green-200" /> Present (hours)</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-200" /> Leave</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-gray-300" /> Weekly off</span>
        </div>
      </div>

      {/* Table — all staff */}
      <div className="overflow-hidden rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Worker</th>
              <th className="px-4 py-3">First in</th>
              <th className="px-4 py-3">Last out</th>
              <th className="px-4 py-3 text-center">Sessions</th>
              <th className="px-4 py-3 text-right">Hours</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No check-ins this month.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{r.dayKey}</td>
                <td className="px-4 py-3 font-medium">{r.userName}{r.isSelf && <span className="ml-1 text-xs text-gray-400">(you)</span>}</td>
                <td className="px-4 py-3 text-gray-600">{fmtTime(r.firstIn)}</td>
                <td className="px-4 py-3 text-gray-600">{fmtTime(r.lastOut)}</td>
                <td className="px-4 py-3 text-center text-gray-600">{r.sessionCount}</td>
                <td className="px-4 py-3 text-right">{fmtHours(r.totalMinutes)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.status === "In progress" ? "bg-amber-50 text-amber-700"
                    : r.status === "Auto-closed" ? "bg-gray-100 text-gray-500"
                    : "bg-green-50 text-green-700"}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
