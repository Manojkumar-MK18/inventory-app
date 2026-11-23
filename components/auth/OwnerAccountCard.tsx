"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { User as UserIcon, Mail, Phone, Pencil, Trash2, Check, X, AlertTriangle } from "lucide-react";
import { updateOwnerProfile, deleteOwnerAccount, type OwnerProfile } from "@/actions/auth";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { digitsOnly, isValidMobile } from "@/lib/otp";

export function OwnerAccountCard({ owner }: { owner: OwnerProfile }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState(owner.name);
  const [mobile, setMobile] = useState(owner.mobile);
  const [err, setErr] = useState<{ name?: string; mobile?: string }>({});

  async function save() {
    const e: typeof err = {};
    if (name.trim().length < 2) e.name = "Enter a valid name";
    if (!isValidMobile(mobile)) e.mobile = "Enter a valid 10-digit mobile";
    setErr(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    const res = await updateOwnerProfile({ name, mobile: digitsOnly(mobile) });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Owner details updated");
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await deleteOwnerAccount();
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Account deleted");
    await signOut({ callbackUrl: "/register" });
  }

  // ---- Delete confirmation ----
  if (confirmDel) {
    return (
      <div className="mb-5 rounded-2xl border border-red-200 bg-red-50/60 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Delete this owner account?</p>
            <p className="mt-0.5 text-xs text-red-600">
              This permanently removes <b>{owner.email}</b>. It cannot be undone. (No shop has been
              created yet, so no business data is lost.)
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="outlined" onClick={() => setConfirmDel(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                onClick={remove}
                loading={busy}
                className="bg-red-600 hover:bg-red-700 active:bg-red-800"
              >
                <Trash2 className="h-4 w-4" /> Delete permanently
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Edit mode ----
  if (editing) {
    return (
      <div className="mb-5 rounded-2xl border border-gray-200 bg-gray-50/60 p-4">
        <p className="mb-3 text-sm font-semibold text-gray-800">Edit owner</p>
        <div className="flex flex-col gap-3">
          <TextField
            label="Full name"
            startIcon={<UserIcon className="h-4 w-4" />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={err.name}
          />
          <TextField
            label="Mobile number"
            inputMode="numeric"
            maxLength={10}
            startIcon={<Phone className="h-4 w-4" />}
            value={mobile}
            onChange={(e) => setMobile(digitsOnly(e.target.value))}
            error={err.mobile}
          />
          <div className="rounded-lg bg-white px-3 py-2 text-xs text-gray-400">
            Email ({owner.email}) is your login — change it from Settings later.
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="outlined" onClick={() => setEditing(false)} disabled={busy}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            <Check className="h-4 w-4" /> Save
          </Button>
        </div>
      </div>
    );
  }

  // ---- View mode ----
  return (
    <div className="mb-5 rounded-2xl border border-gray-200 bg-gray-50/60 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
          {owner.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{owner.name}</p>
          <p className="flex items-center gap-1 truncate text-xs text-gray-500">
            <Mail className="h-3 w-3" /> {owner.email}
          </p>
          {owner.mobile && (
            <p className="flex items-center gap-1 truncate text-xs text-gray-500">
              <Phone className="h-3 w-3" /> {owner.mobile}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => setEditing(true)}
            className="rounded-full p-2 text-gray-500 transition hover:bg-brand-50 hover:text-brand-700"
            aria-label="Edit owner"
            title="Edit owner"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setConfirmDel(true)}
            className="rounded-full p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
            aria-label="Delete owner"
            title="Delete owner account"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
