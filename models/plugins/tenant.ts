/**
 * Tenant-safety plugin. Attach to every business-owned schema. It makes businessId
 * required and indexed, and THROWS if any find/update/delete runs without a businessId
 * in the filter. A forgotten tenant filter becomes a crash you catch in tests, not a
 * silent cross-shop data leak.
 */
import { Schema } from "mongoose";

const GUARDED_OPS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "countDocuments",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
] as const;

export function tenantPlugin(schema: Schema): void {
  schema.add({
    businessId: { type: Schema.Types.ObjectId, required: true, index: true },
  });

  for (const op of GUARDED_OPS) {
    schema.pre(op as any, function (this: any) {
      const filter = this.getFilter?.() ?? {};
      if (filter.businessId === undefined || filter.businessId === null) {
        throw new Error(
          `Tenant guard: ${op} on ${this.model?.modelName ?? "collection"} ran without businessId`
        );
      }
    });
  }
}
