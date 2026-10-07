"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2 } from "lucide-react";
import { addStaff, removeStaff, type StaffDTO } from "@/actions/staff";
import { Field } from "@/components/InfoTip";

const inputCls = "rounded-lg border border-gray-300 px-3 py-2 text-sm";

export function StaffManager({ staff }: { staff: StaffDTO[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const f = new FormData(e.currentTarget);
    const res = await addStaff({ name: f.get("name"), email: f.get("email"), password: f.get("password"), role: f.get("role") });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    (e.target as HTMLFormElement).reset();
    setOpen(false);
    router.refresh();
  }

  async function onRemove(memberId: string) {
    const res = await removeStaff(memberId);
    if (!res.ok) return alert(res.error);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Team &amp; logins</h2>
          <p className="text-sm text-gray-500">Add workers who can sign in. They log in with their own email and password.</p>
        </div>
        <button onClick={() => setOpen((s) => !s)} className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white">
          <UserPlus size={16} /> Add worker
        </button>
      </div>

      {open && (
        <form onSubmit={onSubmit} className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <Field label="Worker name" hint="The person's name — shown in the team list and as the bill creator.">
            <input name="name" required placeholder="e.g. Suresh" className={`${inputCls} w-full`} />
          </Field>
          <Field label="Email (their login)" hint="They sign in with this email. Each worker needs a unique email.">
            <input name="email" type="email" required placeholder="worker@email.com" className={`${inputCls} w-full`} />
          </Field>
          <Field label="Temporary password" hint="Set a starting password and share it with the worker. They can reset it later via Forgot password.">
            <input name="password" type="password" required minLength={8} placeholder="min 8 characters" className={`${inputCls} w-full`} />
          </Field>
          <Field label="Role" hint="Cashier can only create bills. Manager can also manage products and purchases. Only you (Owner) can change settings and team.">
            <select name="role" defaultValue="CASHIER" className={`${inputCls} w-full`}>
              <option value="CASHIER">Cashier — billing only</option>
              <option value="MANAGER">Manager — billing, products, purchases</option>
            </select>
          </Field>
          {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
            <button disabled={saving} className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? "Adding…" : "Add worker"}</button>
          </div>
        </form>
      )}

      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
          <tr><th className="py-2">Name</th><th>Email</th><th>Role</th><th></th></tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {staff.map((s) => (
            <tr key={s.memberId}>
              <td className="py-2.5 font-medium">{s.name}{s.isSelf && <span className="ml-1 text-xs text-gray-400">(you)</span>}</td>
              <td className="text-gray-500">{s.email}</td>
              <td>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{s.role}</span>
              </td>
              <td className="text-right">
                {!s.isSelf && s.role !== "OWNER" && (
                  <button onClick={() => onRemove(s.memberId)} className="text-red-500 hover:text-red-700" title="Remove">
                    <Trash2 size={15} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
