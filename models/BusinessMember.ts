import { Schema, model, models } from "mongoose";

/**
 * Join between users and businesses, carrying the role. Queried BOTH ways
 * (a user's businesses; a business's staff), so it is NOT under the strict
 * tenant plugin — but every lookup still filters by businessId or userId.
 */
const businessMemberSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["OWNER", "MANAGER", "CASHIER"],
      required: true,
    },
  },
  { timestamps: true }
);

businessMemberSchema.index({ userId: 1, businessId: 1 }, { unique: true });
businessMemberSchema.index({ businessId: 1 });

export const BusinessMemberModel =
  models.BusinessMember || model("BusinessMember", businessMemberSchema);
