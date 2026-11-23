"use client";

import { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Material "outlined" select that matches <TextField> height and label position,
 * so text fields and selects line up perfectly in the same grid row.
 * A select always has a value, so the label stays pinned at the top.
 */
type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
};

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, hint, className = "", id, children, ...rest },
  ref
) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className="w-full">
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={`peer block w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 pb-2 pt-5 text-sm text-gray-900 outline-none transition hover:border-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 ${className}`}
          {...rest}
        >
          {children}
        </select>
        <label
          htmlFor={selectId}
          className="pointer-events-none absolute left-3 top-2 text-xs font-medium text-gray-500 peer-focus:text-brand-600"
        >
          {label}
        </label>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      </div>
      {hint && <p className="mt-1 pl-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
});
