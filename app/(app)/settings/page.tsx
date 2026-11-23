import { getBusiness } from "@/actions/settings";
import { requireOwner } from "@/lib/context";
import { ShopProfileCard } from "@/components/settings/ShopProfileCard";
import { ShopPreferences } from "@/components/settings/ShopPreferences";
import { COMPANY, APP_NAME, APP_VERSION } from "@/components/Brand";

export default async function SettingsPage() {
  await requireOwner();
  const business = await getBusiness();

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Settings & Security</h1>
        <p className="mt-1 text-sm text-gray-500">
          Shop profile, tax and invoice — used on bills and across the app. Manage team logins in{" "}
          <span className="font-medium text-gray-600">Employees &amp; Roles</span>.
        </p>
      </div>

      <ShopProfileCard business={business} />
      <ShopPreferences business={business} />

      <p className="text-center text-xs text-gray-400">
        {COMPANY} · {APP_NAME} · {APP_VERSION}
      </p>
    </div>
  );
}
