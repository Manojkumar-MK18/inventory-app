import { requireView } from "@/lib/context";
import { listProducts } from "@/actions/products";
import { listPurchases } from "@/actions/purchases";
import { listSuppliers } from "@/actions/suppliers";
import { listCategories } from "@/actions/categories";
import { PurchaseManager } from "@/components/purchases/PurchaseManager";

export default async function PurchasesPage() {
  await requireView("purchases");
  // Products list includes drafts so you can buy items not yet ready to sell.
  const [products, purchases, suppliers, categories] = await Promise.all([
    listProducts(), listPurchases(), listSuppliers(), listCategories(),
  ]);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Purchases</h1>
      <PurchaseManager products={products} purchases={purchases} supplierNames={suppliers.map((s) => s.name)} categories={categories} />
    </div>
  );
}
