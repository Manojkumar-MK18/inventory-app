import { Schema, model, models } from "mongoose";
import { tenantPlugin } from "./plugins/tenant";

/** A single in/out session within a day. checkOut null = still inside. */
const sessionSchema = new Schema(
  {
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, default: null },
  },
  { _id: false }
);

/**
 * One record per user per IST day, holding multiple in/out sessions (people step out
 * for lunch/errands and return). Days with no record in the past are "Leave" at render
 * time — no cron needed.
 */
const attendanceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dayKey: { type: String, required: true }, // YYYY-MM-DD in IST
    sessions: { type: [sessionSchema], default: [] },
  },
  { timestamps: true }
);

attendanceSchema.plugin(tenantPlugin);
attendanceSchema.index({ businessId: 1, userId: 1, dayKey: 1 }, { unique: true });
attendanceSchema.index({ businessId: 1, dayKey: -1 });

export const AttendanceModel = models.Attendance || model("Attendance", attendanceSchema);
