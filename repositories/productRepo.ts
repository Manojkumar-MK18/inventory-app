/**
 * Repository layer: the ONLY place that queries the DB. Every method injects
 * ctx.businessId so callers (actions/pages) can never forget the tenant filter.
 */
import { connectDB } from "@/lib/db";
import type { Ctx } from "@/lib/session";
import { ProductModel } from "@/models/Product";

export function productRepo(ctx: Ctx) {
  const scope = { businessId: ctx.businessId };

  return {
    async list(filter: Record<string, unknown> = {}) {
      await connectDB();
      return ProductModel.find({ ...scope, ...filter }).lean();
    },

    async getById(id: string) {
      await connectDB();
      return ProductModel.findOne({ ...scope, _id: id }).lean();
    },

    async lowStock() {
      await connectDB();
      return ProductModel.find({
        ...scope,
        isActive: true,
        $expr: { $lte: ["$currentStock", "$minStock"] },
      }).lean();
    },

    async create(data: Record<string, unknown>) {
      await connectDB();
      return ProductModel.create({ ...data, ...scope });
    },

    async update(id: string, data: Record<string, unknown>) {
      await connectDB();
      return ProductModel.findOneAndUpdate({ ...scope, _id: id }, data, { new: true });
    },
  };
}
