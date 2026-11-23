"use client";

import { Check } from "lucide-react";

/** Material-style horizontal stepper with a connecting progress line. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all
                  ${
                    done
                      ? "bg-brand-600 text-white"
                      : active
                      ? "bg-brand-600 text-white ring-4 ring-brand-100"
                      : "bg-gray-100 text-gray-400"
                  }`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`whitespace-nowrap text-[11px] font-medium ${
                  active ? "text-brand-700" : done ? "text-gray-600" : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="mx-2 -mt-5 h-0.5 flex-1 rounded bg-gray-100">
                <div
                  className={`h-full rounded bg-brand-600 transition-all duration-300 ${
                    done ? "w-full" : "w-0"
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
