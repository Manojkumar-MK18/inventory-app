"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, ShieldCheck, X } from "lucide-react";
import { addStaff, removeStaff, setStaffPermissions, type StaffDTO } from "@/actions/staff";
import { Field } from "@/components/InfoTip";
import { MODULES, DEFAULT_PERMISSIONS, type PermLevel, type Permissions } from "@/lib/permissions";

const inputCls = "rounded-lg border border-gray-300 px-3 py-2 text-sm";
const LEVELS: { key: PermLevel; label: string }[] = [
  { key: "none", label: "No access" },
  { key: "view", label: "View" },
  { key: "edit", label: "View + Edit" },
];

/** A role-based starting set so the owner doesn't have to set everything by hand. */
function presetFor(role: "MANAGER" | "CASHIER"): Permissions {
  if (role === "MANAGER") {
    return { dashboard: "view", pos: "edit", sales: "view", returns: "edit", products: "edit", purchases: "edit", customers: "edit", suppliers: "edit", expenses: "edit", attendance: "view", reports: "view" };
  }
  return { ...DEFAULT_PERMISSIONS };
}

function PermissionGrid({ value, onChange }: { value: Permissions; onChange: (p: Permissions) => void }) {
  return (
    <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
      {MODULES.map((m) => {
        const cur = value[m.key] ?? "none";
        return (
          <div key={m.key} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-sm font-medium text-gray-700">{m.label}</span>
            <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
              {LEVELS.map((lv) => (
                <button key={lv.key} type="button" onClick={() => onChange({ ...value, [m.key]: lv.key })}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${cur === lv.key ? (lv.key === "none" ? "bg-white text-gray-600 shadow" : lv.key === "view" ? "bg-white text-indigo-600 shadow" : "bg-white text-emerald-600 shadow") : "text-gray-400 hover:text-gray-600"}`}>
                  {lv.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StaffManager({ staff }: { staff: StaffDTO[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<"CASHIER" | "MANAGER">("CASHIER");
  const [perms, setPerms] = useState<Permissions>(presetFor("CASHIER"));
  const [editFor, setEditFor] = useState<StaffDTO | null>(null);

  function pickRole(r: "CASHIER" | "MANAGER") {
    setRole(r);
    setPerms(presetFor(r)); // reset to that role's sensible defaults; owner can tweak
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setSaving(true);
    const f = new FormData(e.currentTarget);
    const res = await addStaff({ name: f.get("name"), email: f.get("email"), password: f.get("password"), role, permissions: perms });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    (e.target as HTMLFormElement).reset();
    setOpen(false); setRole("CASHIER"); setPerms(presetFor("CASHIER"));
    router.refresh();
  }

  async function onRemove(memberId: string) {
    const res = await removeStaff(memberId);
    if (!res.ok) return alert(res.error);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Team &amp; logins</h2>
          <p className="text-sm text-gray-500">Add workers and choose exactly which menus they can see and edit. You (Owner) always have full access.</p>
        </div>
        <button onClick={() => setOpen((s) => !s)} className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white">
          <UserPlus size={16} /> Add worker
        </button>
      </div>

      {open && (
        <form onSubmit={onSubmit} className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Worker name" hint="Shown in the team list and as the bill creator.">
              <input name="name" required placeholder="e.g. Suresh" className={`${inputCls} w-full`} />
            </Field>
            <Field label="Email (their login)" hint="They sign in with this email. Each worker needs a unique email.">
              <input name="email" type="email" required placeholder="worker@email.com" className={`${inputCls} w-full`} />
            </Field>
            <Field label="Temporary password" hint="Share it with the worker; they can reset it later via Forgot password.">
              <input name="password" type="password" required minLength={8} placeholder="min 8 characters" className={`${inputCls} w-full`} />
            </Field>
            <Field label="Role" hint="A starting point — Manager starts with more access. You can fine-tune every menu below.">
              <select value={role} onChange={(e) => pickRole(e.target.value as any)} className={`${inputCls} w-full`}>
                <option value="CASHIER">Cashier</option>
                <option value="MANAGER">Manager</option>
              </select>
            </Field>
          </div>

          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Menu access</p>
          <PermissionGrid value={perms} onChange={setPerms} />

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
            <button disabled={saving} className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? "Adding…" : "Add worker"}</button>
          </div>
        </form>
      )}

      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
          <tr><th className="py-2">Name</th><th>Email</th><th>Role</th><th className="text-right">Actions</th></tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {staff.map((s) => (
            <tr key={s.memberId}>
              <td className="py-2.5 font-medium">{s.name}{s.isSelf && <span className="ml-1 text-xs text-gray-400">(you)</span>}</td>
              <td className="text-gray-500">{s.email}</td>
              <td><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{s.role}</span></td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {s.role !== "OWNER" && (
                    <button onClick={() => setEditFor(s)} className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-gray-100" title="Change what menus this worker can access">
                      <ShieldCheck size={13} /> Access
                    </button>
                  )}
                  {!s.isSelf && s.role !== "OWNER" && (
                    <button onClick={() => onRemove(s.memberId)} className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs text-red-600 hover:bg-red-50" title="Remove">
                      <Trash2 size={13} /> Remove
                    </button>
                  )}
                  {s.role === "OWNER" && <span className="text-xs text-gray-400">Full access</span>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editFor && <EditPermsModal staff={editFor} onClose={() => setEditFor(null)} onSaved={() => { setEditFor(null); router.refresh(); }} />}
    </div>
  );
}

function EditPermsModal({ staff, onClose, onSaved }: { staff: StaffDTO; onClose: () => void; onSaved: () => void }) {
  const [perms, setPerms] = useState<Permissions>({ ...DEFAULT_PERMISSIONS, ...(staff.permissions as Permissions) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true); setError("");
    const res = await setStaffPermissions({ memberId: staff.memberId, permissions: perms });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Menu access — {staff.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <p className="mb-4 text-sm text-gray-500">Choose what this worker can see and edit. Changes apply the next time they sign in.</p>
        <PermissionGrid value={perms} onChange={setPerms} />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? "Saving…" : "Save access"}</button>
        </div>
      </div>
    </div>
  );
}
