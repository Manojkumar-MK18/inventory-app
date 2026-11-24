import { requireView } from "@/lib/context";
import { can } from "@/lib/permissions";
import { listProducts, listBrands } from "@/actions/products";
import { listCategories } from "@/actions/categories";
import { getBusiness } from "@/actions/settings";
import { ProductManager } from "@/components/products/ProductManager";

export default async function ProductsPage() {
  const ctx = await requireView("products");
  const canEdit = can(ctx, "products", "edit");
  const [products, categories, brands, business] = await Promise.all([
    listProducts(), listCategories(), listBrands(), getBusiness(),
  ]);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Products</h1>
      <ProductManager initial={products} categories={categories} brands={brands} shopName={business.name || "Shop"} canEdit={canEdit} />
    </div>
  );
}
