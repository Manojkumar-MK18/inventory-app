import { Store } from "lucide-react";

export const COMPANY = "Knowtech Labs";
export const APP_NAME = "POS & Inventory";
export const COPYRIGHT_YEAR = 2026;

/** Logo mark + app name. Used on auth screens and onboarding. */
export function BrandMark({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
        <Store size={26} />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold tracking-tight">{APP_NAME}</p>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}

/** Copyright line. */
export function Copyright({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-gray-400 ${className}`}>
      © {COPYRIGHT_YEAR} {COMPANY} · All rights reserved.
    </p>
  );
}
