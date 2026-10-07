/**
 * Proves the tenant guard against a real (in-memory) MongoDB:
 *  - a query without businessId throws
 *  - shop A never sees shop B's data
 *  - the same SKU is allowed across two shops (unique index is per-business)
 *
 * This is the one test you must never let regress — it's the difference between
 * isolated and leaked tenant data.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ProductModel } from "@/models/Product";

let mongod: MongoMemoryServer;
const shopA = new mongoose.Types.ObjectId();
const shopB = new mongoose.Types.ObjectId();

describe("tenant isolation", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await ProductModel.syncIndexes();
    await ProductModel.create([
      { businessId: shopA, name: "A-item", sku: "TS001", salePrice: 10000 },
      { businessId: shopB, name: "B-item", sku: "TS001", salePrice: 20000 },
    ]);
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod?.stop();
  });

  it("same SKU allowed across two shops (unique index is per-business)", async () => {
    const a = await ProductModel.find({ businessId: shopA, sku: "TS001" });
    const b = await ProductModel.find({ businessId: shopB, sku: "TS001" });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].name).toBe("A-item");
  });

  it("shop A query never returns shop B rows", async () => {
    const rows = await ProductModel.find({ businessId: shopA });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.businessId.equals(shopA))).toBe(true);
  });

  it("a query WITHOUT businessId throws (the guard)", async () => {
    await expect(ProductModel.find({ sku: "TS001" })).rejects.toThrow(/businessId/);
  });
});
