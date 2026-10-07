import { getBusiness } from "@/actions/settings";
import { listStaff } from "@/actions/staff";
import { getContext } from "@/lib/context";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { StaffManager } from "@/components/settings/StaffManager";

export default async function SettingsPage() {
  const ctx = await getContext();
  const [business, staff] = await Promise.all([getBusiness(), listStaff()]);
  const isOwner = ctx.role === "OWNER";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-gray-400">Shop details used on bills and for GST.</p>
      </div>

      <SettingsForm business={business} />

      {isOwner ? (
        <StaffManager staff={staff} />
      ) : (
        <p className="text-sm text-gray-400">Only the shop owner can manage team logins.</p>
      )}
    </div>
  );
}
