/**
 * Run on deploy (NOT on every app start) to create/update indexes from the schemas.
 *   npm run sync-indexes
 */
import { connectDB } from "@/lib/db";
import { ProductModel } from "@/models/Product";
import { SaleModel } from "@/models/Sale";
import { StockMovementModel } from "@/models/StockMovement";
import { CounterModel } from "@/models/Counter";

async function main() {
  await connectDB();
  const models = [ProductModel, SaleModel, StockMovementModel, CounterModel];
  for (const m of models) {
    await m.syncIndexes();
    console.log(`synced indexes: ${m.modelName}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
