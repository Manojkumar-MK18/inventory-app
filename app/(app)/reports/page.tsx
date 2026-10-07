import { getReport } from "@/actions/reports";
import { ReportView } from "@/components/reports/ReportView";

export default async function ReportsPage() {
  const initial = await getReport();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-gray-400">Your sales, profit and stock — this month by default. Pick dates to see any period.</p>
      </div>
      <ReportView initial={initial} />
    </div>
  );
}
