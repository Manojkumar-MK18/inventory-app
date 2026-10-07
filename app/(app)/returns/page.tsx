import { listReturns } from "@/actions/returns";
import { ReturnsManager } from "@/components/returns/ReturnsManager";

export default async function ReturnsPage() {
  const returns = await listReturns();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Returns</h1>
        <p className="text-sm text-gray-400">Take an item back — stock, money and discount all update automatically. The original bill is never changed.</p>
      </div>
      <ReturnsManager initialReturns={returns} />
    </div>
  );
}
