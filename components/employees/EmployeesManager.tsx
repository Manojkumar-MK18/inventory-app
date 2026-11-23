"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, ShieldCheck, X, Mail, User as UserIcon, Lock } from "lucide-react";
import { addStaff, removeStaff, setStaffPermissions, type StaffDTO } from "@/actions/staff";
import { MODULES, DEFAULT_PERMISSIONS, type PermLevel, type Permissions } from "@/lib/permissions";
import { ASSIGNABLE_ROLES, ROLE_META, ROLE_PRESETS, type AppRole } from "@/lib/roles";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const LEVELS: { key: PermLevel; label: string }[] = [
  { key: "none", label: "No access" },
  { key: "view", label: "View" },
  { key: "edit", label: "Edit" },
];

const ROLE_CHIP: Record<string, string> = {
  OWNER: "bg-brand-100 text-brand-800",
  MANAGER: "bg-emerald-100 text-emerald-800",
  CASHIER: "bg-amber-100 text-amber-800",
  SALES: "bg-sky-100 text-sky-800",
  STOCK: "bg-violet-100 text-violet-800",
  ACCOUNTANT: "bg-rose-100 text-rose-800",
};

function roleLabel(r: string) {
  return ROLE_META[r as AppRole]?.label ?? r;
}

function PermissionGrid({ value, onChange }: { value: Permissions; onChange: (p: Permissions) => void }) {
  return (
    <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
      {MODULES.map((m) => {
        const cur = value[m.key] ?? "none";
        return (
          <div key={m.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-sm font-medium text-gray-700">{m.label}</span>
            <div className="flex gap-0.5 rounded-full bg-gray-100 p-0.5">
              {LEVELS.map((lv) => {
                const active = cur === lv.key;
                const tone =
                  lv.key === "edit" ? "text-emerald-700" : lv.key === "view" ? "text-brand-700" : "text-gray-600";
                return (
                  <button key={lv.key} type="button" onClick={() => onChange({ ...value, [m.key]: lv.key })}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      active ? `bg-white shadow ${tone}` : "text-gray-400 hover:text-gray-600"
                    }`}>
                    {lv.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function EmployeesManager({ staff }: { staff: StaffDTO[] }) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editFor, setEditFor] = useState<StaffDTO | null>(null);

  async function onRemove(s: StaffDTO) {
    if (!confirm(`Remove ${s.name}? They will lose access to this shop.`)) return;
    const res = await removeStaff(s.memberId);
    if (!res.ok) return toast.error(res.error);
    toast.success(`${s.name} removed`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Team list */}
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-card">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Team & logins</h2>
            <p className="mt-0.5 text-sm text-gray-500">{staff.length} member{staff.length !== 1 ? "s" : ""}</p>
          </div>
          <Button onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" /> Add worker
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {staff.map((s) => (
            <div key={s.memberId} className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-base font-bold text-white">
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {s.name}{s.isSelf && <span className="ml-1 text-xs font-normal text-gray-400">(you)</span>}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                    <Mail className="h-3 w-3" /> {s.email}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_CHIP[s.role] ?? "bg-gray-100 text-gray-600"}`}>
                  {roleLabel(s.role)}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                {s.role === "OWNER" ? (
                  <span className="text-xs font-medium text-gray-400">Full access</span>
                ) : (
                  <>
                    <Button variant="tonal" onClick={() => setEditFor(s)} className="px-3 py-1.5 text-xs">
                      <ShieldCheck className="h-3.5 w-3.5" /> Access
                    </Button>
                    {!s.isSelf && (
                      <button onClick={() => onRemove(s)}
                        className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {adding && <AddWorkerModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); router.refresh(); }} />}
      {editFor && <EditAccessModal staff={editFor} onClose={() => setEditFor(null)} onSaved={() => { setEditFor(null); router.refresh(); }} />}
    </div>
  );
}

function AddWorkerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Exclude<AppRole, "OWNER">>("CASHIER");
  const [perms, setPerms] = useState<Permissions>({ ...ROLE_PRESETS.CASHIER });
  const [err, setErr] = useState("");

  function pickRole(r: Exclude<AppRole, "OWNER">) {
    setRole(r);
    setPerms({ ...ROLE_PRESETS[r] }); // reset to that role's sensible defaults
  }

  async function save() {
    setErr("");
    if (name.trim().length < 2) return setErr("Enter the worker's name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr("Enter a valid email");
    if (password.length < 8) return setErr("Password must be at least 8 characters");
    setSaving(true);
    const res = await addStaff({ name, email, password, role, permissions: perms });
    setSaving(false);
    if (!res.ok) return setErr(res.error);
    toast.success(`${name} added as ${ROLE_META[role].label}`);
    onSaved();
  }

  return (
    <Modal title="Add worker" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Worker name" startIcon={<UserIcon className="h-4 w-4" />} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="Email (their login)" type="email" startIcon={<Mail className="h-4 w-4" />} value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Temporary password" type="password" startIcon={<Lock className="h-4 w-4" />} value={password} onChange={(e) => setPassword(e.target.value)} hint="Min 8 characters — they can reset it later" />
          <Select label="Role" value={role} onChange={(e) => pickRole(e.target.value as Exclude<AppRole, "OWNER">)}>
            {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
          </Select>
        </div>
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
          <b>{ROLE_META[role].label}</b> — {ROLE_META[role].job}. Access below is pre-filled for this role; adjust any menu.
        </p>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Menu access</p>
          <PermissionGrid value={perms} onChange={setPerms} />
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="outlined" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving}>{saving ? "Adding…" : "Add worker"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function EditAccessModal({ staff, onClose, onSaved }: { staff: StaffDTO; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [perms, setPerms] = useState<Permissions>({ ...DEFAULT_PERMISSIONS, ...(staff.permissions as Permissions) });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await setStaffPermissions({ memberId: staff.memberId, permissions: perms });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Access updated");
    onSaved();
  }

  function applyPreset() {
    const preset = ROLE_PRESETS[staff.role as Exclude<AppRole, "OWNER">];
    if (preset) { setPerms({ ...preset }); toast.info(`Reset to default ${ROLE_META[staff.role as AppRole].label} access`); }
  }

  return (
    <Modal title={`Menu access — ${staff.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Changes apply next time they sign in.</p>
          {ROLE_PRESETS[staff.role as Exclude<AppRole, "OWNER">] && (
            <button onClick={applyPreset} className="text-xs font-semibold text-brand-700 hover:underline">
              Reset to {ROLE_META[staff.role as AppRole].label} default
            </button>
          )}
        </div>
        <PermissionGrid value={perms} onChange={setPerms} />
        <div className="flex justify-end gap-3">
          <Button variant="outlined" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving}>{saving ? "Saving…" : "Save access"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-3xl bg-white p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
