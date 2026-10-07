"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { getContext } from "@/lib/context";
import { connectDB } from "@/lib/db";
import { AttendanceModel } from "@/models/Attendance";
import { UserModel } from "@/models/User";

export type ActionResult = { ok: true } | { ok: false; error: string };

const IST_MS = 5.5 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

function istDayKey(d: Date): string {
  const ist = new Date(d.getTime() + IST_MS);
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`;
}

interface Session {
  checkIn: Date;
  checkOut: Date | null;
}
const lastSession = (s: Session[]): Session | undefined => s[s.length - 1];
const isOpen = (s: Session[]) => !!lastSession(s) && !lastSession(s)!.checkOut;

export interface TodayStatus {
  open: boolean; // currently checked in
  sessions: number; // completed + current
  lastInTime: string | null;
}

export async function getTodayStatus(): Promise<TodayStatus> {
  const ctx = await getContext();
  await connectDB();
  const rec = await AttendanceModel.findOne({
    businessId: new mongoose.Types.ObjectId(ctx.businessId),
    userId: new mongoose.Types.ObjectId(ctx.userId),
    dayKey: istDayKey(new Date()),
  }).lean<{ sessions: Session[] }>();

  const sessions = rec?.sessions ?? [];
  const open = isOpen(sessions);
  return {
    open,
    sessions: sessions.length,
    lastInTime: open ? new Date(lastSession(sessions)!.checkIn).toISOString() : null,
  };
}

/** Open a new session (check in). Blocked if a session is already open. */
export async function checkIn(): Promise<ActionResult> {
  const ctx = await getContext();
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const uId = new mongoose.Types.ObjectId(ctx.userId);
  const dayKey = istDayKey(new Date());

  const rec = await AttendanceModel.findOne({ businessId: bId, userId: uId, dayKey });
  if (rec && isOpen(rec.sessions)) return { ok: false, error: "You are already checked in" };

  if (!rec) {
    await AttendanceModel.create({ businessId: bId, userId: uId, dayKey, sessions: [{ checkIn: new Date() }] });
  } else {
    rec.sessions.push({ checkIn: new Date(), checkOut: null });
    await rec.save();
  }
  revalidatePath("/attendance");
  return { ok: true };
}

/** Close the open session (check out). Blocked if none open. */
export async function checkOut(): Promise<ActionResult> {
  const ctx = await getContext();
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const uId = new mongoose.Types.ObjectId(ctx.userId);
  const dayKey = istDayKey(new Date());

  const rec = await AttendanceModel.findOne({ businessId: bId, userId: uId, dayKey });
  if (!rec || !isOpen(rec.sessions)) return { ok: false, error: "Check in first" };

  lastSession(rec.sessions)!.checkOut = new Date();
  await rec.save();
  revalidatePath("/attendance");
  return { ok: true };
}

export interface AttendanceRow {
  id: string;
  userId: string;
  userName: string;
  isSelf: boolean;
  dayKey: string;
  firstIn: string;
  lastOut: string | null;
  totalMinutes: number; // summed over sessions (past open sessions auto-close at day end)
  sessionCount: number;
  status: "Present" | "In progress" | "Auto-closed";
}

/** UTC instant for 23:59:59 IST of a yyyy-mm-dd — the auto-close cutoff. */
function endOfIstDayUtc(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59) - IST_MS);
}

/** All attendance records for the business in a given IST month (1-12). */
export async function listAttendance(year: number, month: number): Promise<AttendanceRow[]> {
  const ctx = await getContext();
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);
  const prefix = `${year}-${pad(month)}-`;

  const rows = await AttendanceModel.find({ businessId: bId, dayKey: { $regex: `^${prefix}` } })
    .sort({ dayKey: -1 })
    .lean();

  const userIds = [...new Set(rows.map((r: any) => r.userId.toString()))];
  const users = await UserModel.find({ _id: { $in: userIds } }).lean();
  const nameById = new Map(users.map((u: any) => [u._id.toString(), u.name]));

  const todayKey = istDayKey(new Date());

  return rows
    .filter((r: any) => (r.sessions ?? []).length > 0) // skip any malformed/empty record
    .map((r: any) => {
      const sessions: Session[] = r.sessions ?? [];
      const open = isOpen(sessions);
      const isToday = r.dayKey === todayKey;
      // A session left open on a PAST day auto-closes at 23:59 of that day for hours.
      const cutoff = endOfIstDayUtc(r.dayKey);
      const totalMs = sessions.reduce((a, s) => {
        const end = s.checkOut ? new Date(s.checkOut) : isToday ? null : cutoff;
        return a + (end ? end.getTime() - new Date(s.checkIn).getTime() : 0);
      }, 0);

      let lastOut: Date | null = null;
      const lastClosed = [...sessions].reverse().find((s) => s.checkOut);
      if (open && !isToday) lastOut = cutoff;
      else if (lastClosed?.checkOut) lastOut = new Date(lastClosed.checkOut);

      const status: AttendanceRow["status"] = open && isToday ? "In progress" : open ? "Auto-closed" : "Present";

      return {
        id: r._id.toString(),
        userId: r.userId.toString(),
        userName: nameById.get(r.userId.toString()) ?? "—",
        isSelf: r.userId.toString() === ctx.userId,
        dayKey: r.dayKey,
        firstIn: new Date(sessions[0].checkIn).toISOString(),
        lastOut: lastOut ? lastOut.toISOString() : null,
        totalMinutes: Math.round(totalMs / 60000),
        sessionCount: sessions.length,
        status,
      };
    });
}
