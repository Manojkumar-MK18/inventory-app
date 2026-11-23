import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { UserModel } from "@/models/User";
import { tryGetContext } from "@/lib/context";
import { BrandMark, Copyright } from "@/components/Brand";
import { OwnerAccountCard } from "@/components/auth/OwnerAccountCard";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  // Already has a business? Skip onboarding. (Not logged in is handled by middleware.)
  const ctx = await tryGetContext();
  if (ctx) redirect("/dashboard");

  // The owner's own account — read straight from the session + users collection.
  const session = await auth();
  await connectDB();
  const u = session?.user?.id
    ? await UserModel.findById(session.user.id).lean<{
        name: string;
        email: string;
        mobile?: string;
      }>()
    : null;
  const owner = u ? { name: u.name, email: u.email, mobile: u.mobile ?? "" } : null;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 via-white to-gray-100 p-6">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-brand-100/50 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <BrandMark />
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-7 shadow-soft">
          <div className="mb-5">
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white">
                ✓
              </span>
              Owner account ready
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Now set up your shop</h1>
            <p className="mt-1 text-sm text-gray-500">
              You&rsquo;re signed in as the owner — just add your shop details. Change them anytime
              in Settings.
            </p>
          </div>
          {owner && <OwnerAccountCard owner={owner} />}
          <OnboardingForm />
        </div>
        <div className="mt-6 flex justify-center">
          <Copyright />
        </div>
      </div>
    </div>
  );
}
