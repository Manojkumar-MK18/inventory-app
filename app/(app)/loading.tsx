/**
 * Shown instantly on navigation while the page's data loads. The sidebar stays put,
 * so switching pages feels immediate instead of waiting on a server round-trip.
 */
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 h-7 w-48 rounded bg-gray-200" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-gray-200 bg-gray-100" />
        ))}
      </div>
      <div className="mt-6 h-64 rounded-xl border border-gray-200 bg-gray-100" />
    </div>
  );
}
