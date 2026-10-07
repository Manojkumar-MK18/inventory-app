import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { listSales } from "@/actions/sales";
import { listProducts } from "@/actions/products";
import { getContext } from "@/lib/context";
import { connectDB } from "@/lib/db";
import { BusinessModel } from "@/models/Business";
import { SalesTable } from "@/components/sales/SalesTable";
import { BackdatedBill } from "@/components/sales/BackdatedBill";

export default async function SalesPage() {
  const ctx = await getContext();
  const [sales, products] = await Promise.all([listSales(), listProducts({ sellableOnly: true })]);
  await connectDB();
  const b = await BusinessModel.findById(ctx.businessId).lean<{
    name: string; gstin: string | null; gstType: "REGULAR" | "COMPOSITION" | "UNREGISTERED"; pricesIncludeTax: boolean;
  }>();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <div className="flex gap-2">
          <BackdatedBill products={products} gstType={b?.gstType ?? "UNREGISTERED"} pricesIncludeTax={b?.pricesIncludeTax ?? true} />
          <Link href="/pos" className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white">
            <ShoppingCart size={16} /> New bill
          </Link>
        </div>
      </div>
      <SalesTable rows={sales} businessName={b?.name ?? "Shop"} gstin={b?.gstin ?? null} />
    </div>
  );
}
