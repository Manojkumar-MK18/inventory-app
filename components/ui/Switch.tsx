"use client";

/** Material-style switch toggle. */
export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 ${
        disabled ? "opacity-60" : "cursor-pointer hover:border-gray-300"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-800">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-gray-400">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-brand-600" : "bg-gray-300"
        } ${disabled ? "cursor-not-allowed" : ""}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}
