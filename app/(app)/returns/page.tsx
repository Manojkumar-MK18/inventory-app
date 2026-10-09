import { requireView } from "@/lib/context";
import { listReturns } from "@/actions/returns";
import { listProducts } from "@/actions/products";
import { ReturnsManager } from "@/components/returns/ReturnsManager";

export default async function ReturnsPage() {
  await requireView("returns");
  const [returns, products] = await Promise.all([listReturns(), listProducts({ sellableOnly: true })]);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Returns &amp; Exchange</h1>
        <p className="text-sm text-gray-400">Return (money back), Exchange (give a new product), or mark Damage. Stock and money update automatically; the original bill is never changed.</p>
      </div>
      <ReturnsManager initialReturns={returns} products={products} />
    </div>
  );
}
