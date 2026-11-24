import { requireView } from "@/lib/context";
import { listProducts } from "@/actions/products";
import { listPurchases } from "@/actions/purchases";
import { listSuppliers } from "@/actions/suppliers";
import { PurchasesView } from "@/components/purchases/PurchasesView";

export default async function PurchasesPage() {
  await requireView("purchases");
  // Products list includes drafts so you can buy items not yet ready to sell.
  const [products, purchases, suppliers] = await Promise.all([
    listProducts(), listPurchases(), listSuppliers(),
  ]);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-gray-900">Purchases</h1>
      <PurchasesView products={products} purchases={purchases} supplierNames={suppliers.map((s) => s.name)} />
    </div>
  );
}
