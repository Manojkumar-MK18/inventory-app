import { getContext } from "@/lib/context";
import { connectDB } from "@/lib/db";
import { BusinessModel } from "@/models/Business";
import { UserModel } from "@/models/User";
import { Sidebar } from "@/components/Sidebar";
import { AppHeader } from "@/components/AppHeader";
import { getTodayStatus } from "@/actions/attendance";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext(); // redirects to /login or /onboarding as needed
  await connectDB();
  const [business, status, me] = await Promise.all([
    BusinessModel.findById(ctx.businessId).lean<{ name: string }>(),
    getTodayStatus(),
    UserModel.findById(ctx.userId).lean<{ email: string }>(),
  ]);

  const today = new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar businessName={business?.name ?? "Shop"} role={ctx.role} permissions={ctx.permissions ?? {}} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader status={status} today={today} role={ctx.role} currentEmail={me?.email ?? ""} />
        <main className="w-full flex-1 overflow-x-auto p-8">{children}</main>
      </div>
    </div>
  );
}
