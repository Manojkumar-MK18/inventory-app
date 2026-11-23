import { Construction } from "lucide-react";

/** Frontend placeholder for menus whose screens are not built yet. */
export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-3xl border border-dashed border-gray-300 bg-white px-8 py-16 text-center shadow-card">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Construction className="h-8 w-8" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">
          {description ?? "This screen is coming soon."}
        </p>
      </div>
      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
        Coming soon
      </span>
    </div>
  );
}
