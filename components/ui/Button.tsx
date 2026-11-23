"use client";

import { Loader2 } from "lucide-react";

/**
 * Material 3 buttons: filled (default), tonal, text, outlined.
 * Filled uses the brand colour with a subtle elevation that lifts on hover.
 */
type Variant = "filled" | "tonal" | "text" | "outlined";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
};

const VARIANTS: Record<Variant, string> = {
  filled:
    "bg-brand-600 text-white shadow-card hover:bg-brand-700 hover:shadow-soft active:bg-brand-800",
  tonal: "bg-brand-100 text-brand-800 hover:bg-brand-200 active:bg-brand-300",
  text: "bg-transparent text-brand-700 hover:bg-brand-50 active:bg-brand-100",
  outlined:
    "border border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50 active:bg-gray-100",
};

export function Button({
  variant = "filled",
  loading = false,
  fullWidth = false,
  startIcon,
  disabled,
  children,
  className = "",
  ...rest
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold
        transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300
        disabled:cursor-not-allowed disabled:opacity-60
        ${VARIANTS[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : startIcon}
      {children}
    </button>
  );
}
