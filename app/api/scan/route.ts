import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { ProductModel } from "@/models/Product";
import { businessForPair, pushToPair } from "@/lib/scanHub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The phone scanner posts a scanned barcode here with its pairing code.
 * We are NOT authenticated — the pairing code decides which shop to look in
 * (it was bound to a businessId when the POS opened its SSE stream). The result
 * is pushed to the paired POS screen over SSE; we also echo it back to the phone
 * so the scanner can show "Added ✓ / Not found".
 *
 *   POST /api/scan   { barcode: "8901234567890", pair: "XY12AB" }
 */
export async function POST(req: Request) {
  let body: { barcode?: string; pair?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const barcode = (body.barcode ?? "").trim();
  const pair = (body.pair ?? "").trim();
  if (!barcode) return Response.json({ ok: false, error: "No barcode" }, { status: 400 });
  if (!pair) return Response.json({ ok: false, error: "No pair code" }, { status: 400 });

  const businessId = businessForPair(pair);
  if (!businessId) {
    return Response.json(
      { ok: false, error: "Not connected. Open the billing screen and make sure the pair code matches." },
      { status: 409 }
    );
  }

  await connectDB();
  const bId = new mongoose.Types.ObjectId(businessId);
  const product = await ProductModel.findOne({
    businessId: bId,
    isActive: true,
    sellable: true,
    $or: [{ barcode }, { "variants.barcode": barcode }],
  }).lean<{ _id: any; name: string; variants?: { label: string; barcode?: string }[] }>();

  if (!product) {
    pushToPair(pair, { type: "PRODUCT_NOT_FOUND", barcode });
    return Response.json({ ok: false, error: "Product not found", barcode });
  }

  // If a specific size's barcode matched, add that size; else leave it to the POS.
  const variant = (product.variants ?? []).find((v) => v.barcode && v.barcode === barcode);
  const payload = {
    type: "PRODUCT_FOUND" as const,
    barcode,
    productId: product._id.toString(),
    variantLabel: variant?.label ?? null,
    name: product.name,
    hasSizes: (product.variants ?? []).length > 0,
  };
  const delivered = pushToPair(pair, payload);

  return Response.json({ ok: true, name: product.name, variantLabel: payload.variantLabel, delivered });
}
