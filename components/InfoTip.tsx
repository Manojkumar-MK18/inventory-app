"use client";

import { Info } from "lucide-react";

/** Small info icon that shows an explanation on hover. Reused across all forms. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center align-middle">
      <Info size={13} className="cursor-help text-gray-400" />
      <span className="pointer-events-none absolute bottom-5 left-1/2 z-30 w-56 -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

/** Labeled field with an optional info tooltip. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex items-center gap-1.5 font-medium text-gray-700">
        {label}
        {hint && <InfoTip text={hint} />}
      </span>
      {children}
    </label>
  );
}
