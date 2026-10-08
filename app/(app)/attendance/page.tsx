import { requireView } from "@/lib/context";
import { listAttendance } from "@/actions/attendance";
import { getBusiness } from "@/actions/settings";
import { AttendanceView } from "@/components/attendance/AttendanceView";

export default async function AttendancePage() {
  await requireView("attendance");
  const istNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const year = istNow.getFullYear();
  const month = istNow.getMonth() + 1;
  const [rows, business] = await Promise.all([listAttendance(year, month), getBusiness()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <p className="text-sm text-gray-400">Shop open/close and staff check-in — days with no check-in count as leave.</p>
      </div>
      <AttendanceView initialRows={rows} year={year} month={month} weeklyOff={business.weeklyOff} />
    </div>
  );
}
