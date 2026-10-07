import { listProducts } from "@/actions/products";
import { listCategories } from "@/actions/categories";
import { getBusiness } from "@/actions/settings";
import { ProductManager } from "@/components/products/ProductManager";

export default async function ProductsPage() {
  const [products, categories, business] = await Promise.all([listProducts(), listCategories(), getBusiness()]);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Products</h1>
      <ProductManager initial={products} categories={categories} shopName={business.name || "Shop"} />
    </div>
  );
}
