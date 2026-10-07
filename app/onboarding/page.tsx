import { redirect } from "next/navigation";
import { tryGetContext } from "@/lib/context";
import { BrandMark, Copyright } from "@/components/Brand";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  // Already has a business? Skip onboarding. (Not logged in is handled by middleware.)
  const ctx = await tryGetContext();
  if (ctx) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <BrandMark />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h1 className="text-xl font-semibold">Set up your shop</h1>
            <p className="text-sm text-gray-500">You can change these later in Settings.</p>
          </div>
          <OnboardingForm />
        </div>
        <div className="mt-6 flex justify-center">
          <Copyright />
        </div>
      </div>
    </div>
  );
}
