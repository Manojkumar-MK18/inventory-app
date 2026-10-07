import { listProducts } from "@/actions/products";
import { listCategories } from "@/actions/categories";
import { ProductManager } from "@/components/products/ProductManager";

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([listProducts(), listCategories()]);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Products</h1>
      <ProductManager initial={products} categories={categories} />
    </div>
  );
}
