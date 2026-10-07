import { getContext } from "@/lib/context";
import { connectDB } from "@/lib/db";
import { BusinessModel } from "@/models/Business";
import { listProducts } from "@/actions/products";
import { PosScreen } from "@/components/pos/PosScreen";

export default async function PosPage() {
  const ctx = await getContext();
  const products = await listProducts({ sellableOnly: true });

  await connectDB();
  const b = await BusinessModel.findById(ctx.businessId).lean<{
    name: string;
    gstin: string | null;
    gstType: "REGULAR" | "COMPOSITION" | "UNREGISTERED";
    pricesIncludeTax: boolean;
    address: string;
    phone: string;
    instagram: string;
    mapsUrl: string;
  }>();

  return (
    <PosScreen
      products={products}
      businessName={b?.name ?? "Shop"}
      gstin={b?.gstin ?? null}
      gstType={b?.gstType ?? "UNREGISTERED"}
      pricesIncludeTax={b?.pricesIncludeTax ?? true}
      shopAddress={b?.address ?? ""}
      shopPhone={b?.phone ?? ""}
      shopInstagram={b?.instagram ?? ""}
      shopMapsUrl={b?.mapsUrl ?? ""}
    />
  );
}
