"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { z } from "zod";
import { getContext } from "@/lib/context";
import { requireRole } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { UserModel } from "@/models/User";
import { BusinessMemberModel } from "@/models/BusinessMember";
import { hashPassword } from "@/lib/password";

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface StaffDTO {
  memberId: string;
  name: string;
  email: string;
  role: string;
  isSelf: boolean;
}

const addStaffSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(254),
  password: z.string().min(8).max(100),
  role: z.enum(["MANAGER", "CASHIER"]),
});

export async function listStaff(): Promise<StaffDTO[]> {
  const ctx = await getContext();
  await connectDB();
  const members = await BusinessMemberModel.find({ businessId: new mongoose.Types.ObjectId(ctx.businessId) }).lean();
  const userIds = members.map((m: any) => m.userId);
  const users = await UserModel.find({ _id: { $in: userIds } }).lean();
  const byId = new Map(users.map((u: any) => [u._id.toString(), u]));
  return members.map((m: any) => {
    const u = byId.get(m.userId.toString());
    return {
      memberId: m._id.toString(),
      name: u?.name ?? "—",
      email: u?.email ?? "—",
      role: m.role,
      isSelf: m.userId.toString() === ctx.userId,
    };
  });
}

/** Add a worker: create their login (or reuse an existing account) and grant a role here. */
export async function addStaff(raw: unknown): Promise<ActionResult> {
  const ctx = await getContext();
  requireRole(ctx, ["OWNER"]);
  const parsed = addStaffSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the details (password min 8 chars)" };
  const { name, email, password, role } = parsed.data;

  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);

  let user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) {
    user = await UserModel.create({ name, email: email.toLowerCase(), passwordHash: await hashPassword(password) });
  }

  const already = await BusinessMemberModel.findOne({ businessId: bId, userId: user._id });
  if (already) return { ok: false, error: "This person is already a member of this shop" };

  await BusinessMemberModel.create({ businessId: bId, userId: user._id, role });
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeStaff(memberId: string): Promise<ActionResult> {
  const ctx = await getContext();
  requireRole(ctx, ["OWNER"]);
  await connectDB();
  const bId = new mongoose.Types.ObjectId(ctx.businessId);

  const member = await BusinessMemberModel.findOne({ businessId: bId, _id: memberId });
  if (!member) return { ok: false, error: "Member not found" };
  if (member.userId.toString() === ctx.userId) return { ok: false, error: "You cannot remove yourself" };
  if (member.role === "OWNER") return { ok: false, error: "Cannot remove an owner" };

  await BusinessMemberModel.deleteOne({ businessId: bId, _id: memberId });
  revalidatePath("/settings");
  return { ok: true };
}
