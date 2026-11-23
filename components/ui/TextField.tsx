"use client";

import { forwardRef, useId } from "react";

/**
 * Material 3 "outlined" text field with a floating label.
 * The label sits inside the field, then floats up on focus or when filled
 * (we keep the input placeholder a single space so the :placeholder-shown trick works).
 */
type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  startIcon?: React.ReactNode;
  endAdornment?: React.ReactNode;
};

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, error, hint, startIcon, endAdornment, className = "", id, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hasError = !!error;

  return (
    <div className="w-full">
      <div className="relative">
        {startIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {startIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          placeholder=" "
          className={`peer block w-full rounded-lg border bg-white px-3 pb-2 pt-5 text-sm text-gray-900 outline-none transition
            ${startIcon ? "pl-10" : ""} ${endAdornment ? "pr-11" : ""}
            ${
              hasError
                ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                : "border-gray-300 hover:border-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            } ${className}`}
          {...rest}
        />
        <label
          htmlFor={inputId}
          className={`pointer-events-none absolute top-2 ${startIcon ? "left-10" : "left-3"} origin-left text-xs font-medium transition-all
            peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal
            peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-medium
            ${hasError ? "text-red-500 peer-focus:text-red-500" : "text-gray-500 peer-focus:text-brand-600"}`}
        >
          {label}
        </label>
        {endAdornment && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">{endAdornment}</span>
        )}
      </div>
      {hasError ? (
        <p className="mt-1 pl-1 text-xs text-red-500">{error}</p>
      ) : hint ? (
        <p className="mt-1 pl-1 text-xs text-gray-400">{hint}</p>
      ) : null}
    </div>
  );
});
