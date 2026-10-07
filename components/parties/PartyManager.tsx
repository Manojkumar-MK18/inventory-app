"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, IndianRupee, Eye, Pencil, Trash2 } from "lucide-react";
import { formatINR } from "@/lib/money";
import type { PartyHistory } from "@/lib/party-types";

export interface PartyRow {
  id: string;
  name: string;
  phone: string;
  area: string;
  balanceDue: number;
}

type Result = { ok: true } | { ok: false; error: string };

interface Props {
  rows: PartyRow[];
  dueLabel: string; // e.g. "Owes you" / "You owe"
  dueHint?: string; // plain explanation of the due column
  totalLabel?: string; // card label, e.g. "Total to collect"
  settleLabel: string; // e.g. "Receive" / "Pay"
  addLabel: string; // e.g. "Add customer"
  onCreate: (data: { name: string; phone: string; area: string }) => Promise<Result>;
  onSettle: (data: { id: string; amountRupees: number; method: string }) => Promise<Result>;
  onUpdate: (data: { id: string; name: string; phone: string; area: string }) => Promise<Result>;
  onDelete: (id: string) => Promise<Result>;
  onHistory: (id: string) => Promise<PartyHistory>;
}

export function PartyManager({ rows, dueLabel, dueHint, totalLabel, settleLabel, addLabel, onCreate, onSettle, onUpdate, onDelete, onHistory }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [settleFor, setSettleFor] = useState<PartyRow | null>(null);
  const [editFor, setEditFor] = useState<PartyRow | null>(null);
  const [viewFor, setViewFor] = useState<PartyRow | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => !query || r.name.toLowerCase().includes(query) || r.phone.includes(query) || r.area.toLowerCase().includes(query));
  }, [rows, q]);

  const totalDue = filtered.reduce((a, r) => a + r.balanceDue, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or area…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm" />
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white">
          <Plus size={16} /> {addLabel}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">{totalLabel ?? "Total outstanding"}</p>
          <p className={`mt-1 text-2xl font-semibold ${totalDue > 0 ? "text-red-600" : ""}`}>{formatINR(totalDue)}</p>
          {dueHint && <p className="mt-1 text-xs text-gray-400">{dueHint}</p>}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3 text-right">{dueLabel}</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                {rows.length === 0 ? "None yet." : "No matches."}
              </td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-gray-500">{r.phone || "—"}</td>
                <td className="px-4 py-3 text-gray-500">{r.area || "—"}</td>
                <td className={`px-4 py-3 text-right font-medium ${r.balanceDue > 0 ? "text-red-600" : "text-gray-400"}`}>
                  {formatINR(r.balanceDue)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {r.balanceDue > 0 && (
                      <button onClick={() => setSettleFor(r)} className="rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-medium text-white">
                        {settleLabel}
                      </button>
                    )}
                    <button onClick={() => setViewFor(r)} title="View history" className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-100"><Eye size={13} /> View</button>
                    <button onClick={() => setEditFor(r)} title="Edit" className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-100"><Pencil size={13} /> Edit</button>
                    <DeleteButton party={r} onDelete={onDelete} onDone={() => router.refresh()} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && <AddModal addLabel={addLabel} onCreate={onCreate} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); router.refresh(); }} />}
      {settleFor && <SettleModal party={settleFor} settleLabel={settleLabel} onSettle={onSettle} onClose={() => setSettleFor(null)} onSaved={() => { setSettleFor(null); router.refresh(); }} />}
      {editFor && <EditModal party={editFor} onUpdate={onUpdate} onClose={() => setEditFor(null)} onSaved={() => { setEditFor(null); router.refresh(); }} />}
      {viewFor && <ViewModal party={viewFor} dueLabel={dueLabel} onHistory={onHistory} onClose={() => setViewFor(null)} />}
    </div>
  );
}

function DeleteButton({ party, onDelete, onDone }: { party: PartyRow; onDelete: (id: string) => Promise<Result>; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  async function del() {
    if (!confirm(`Delete "${party.name}"? This cannot be undone.`)) return;
    setBusy(true);
    const res = await onDelete(party.id);
    setBusy(false);
    if (!res.ok) return alert(res.error);
    onDone();
  }
  return (
    <button onClick={del} disabled={busy} title="Delete" className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">
      <Trash2 size={13} /> Delete
    </button>
  );
}

const inputCls = "rounded-lg border border-gray-300 px-3 py-2 text-sm w-full";

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function AddModal({ addLabel, onCreate, onClose, onSaved }: { addLabel: string; onCreate: Props["onCreate"]; onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const f = new FormData(e.currentTarget);
    const res = await onCreate({ name: String(f.get("name")), phone: String(f.get("phone") || ""), area: String(f.get("area") || "") });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onSaved();
  }
  return (
    <Modal title={addLabel} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input name="name" required placeholder="Name" className={inputCls} autoFocus />
        <input name="phone" placeholder="Phone (optional)" className={inputCls} />
        <input name="area" placeholder="Area (optional)" className={inputCls} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          <button disabled={saving} className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}

function SettleModal({ party, settleLabel, onSettle, onClose, onSaved }: { party: PartyRow; settleLabel: string; onSettle: Props["onSettle"]; onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const f = new FormData(e.currentTarget);
    const res = await onSettle({ id: party.id, amountRupees: Number(f.get("amount")), method: String(f.get("method")) });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onSaved();
  }
  return (
    <Modal title={`${settleLabel} — ${party.name}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm text-gray-500">Outstanding: <b>{formatINR(party.balanceDue)}</b></p>
        <div className="relative">
          <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input name="amount" type="number" min={1} step="0.01" required max={party.balanceDue / 100}
            defaultValue={(party.balanceDue / 100).toFixed(2)} className={`${inputCls} pl-8`} autoFocus />
        </div>
        <select name="method" className={inputCls} defaultValue="CASH">
          <option value="CASH">Cash</option>
          <option value="UPI">UPI</option>
          <option value="CARD">Card</option>
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          <button disabled={saving} className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? "Saving…" : settleLabel}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditModal({ party, onUpdate, onClose, onSaved }: { party: PartyRow; onUpdate: Props["onUpdate"]; onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const f = new FormData(e.currentTarget);
    const res = await onUpdate({ id: party.id, name: String(f.get("name")), phone: String(f.get("phone") || ""), area: String(f.get("area") || "") });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onSaved();
  }
  return (
    <Modal title="Edit details" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input name="name" required defaultValue={party.name} placeholder="Name" className={inputCls} autoFocus />
        <input name="phone" defaultValue={party.phone} placeholder="Phone" className={inputCls} />
        <input name="area" defaultValue={party.area} placeholder="Area" className={inputCls} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          <button disabled={saving} className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ViewModal({ party, dueLabel, onHistory, onClose }: { party: PartyRow; dueLabel: string; onHistory: Props["onHistory"]; onClose: () => void }) {
  const [data, setData] = useState<PartyHistory | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    onHistory(party.id)
      .then((d) => { if (active) setData(d); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [party.id, onHistory]);

  const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{party.name}</h2>
            <p className="text-sm text-gray-500">{[party.phone, party.area].filter(Boolean).join(" · ") || "No contact details"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-gray-400">{dueLabel}</p>
            <p className={`text-lg font-semibold ${party.balanceDue > 0 ? "text-red-600" : "text-gray-500"}`}>{formatINR(party.balanceDue)}</p>
          </div>
        </div>

        {failed ? (
          <p className="py-8 text-center text-sm text-red-500">Could not load history. Please try again.</p>
        ) : !data ? (
          <p className="py-8 text-center text-sm text-gray-400">Loading history…</p>
        ) : (
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="mb-2 text-sm font-semibold">{data.entriesLabel}</h3>
              {data.entries.length === 0 ? (
                <p className="text-sm text-gray-400">No {data.entriesLabel.toLowerCase()} yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {data.entries.map((e, i) => (
                    <li key={i} className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium">{e.title}</p>
                        <p className="text-xs text-gray-400">{fmtDate(e.date)} · {e.detail}</p>
                      </div>
                      <span className="font-medium">{formatINR(e.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Payments</h3>
              {data.payments.length === 0 ? (
                <p className="text-sm text-gray-400">No payments recorded.</p>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {data.payments.map((p, i) => (
                    <li key={i} className="flex items-center justify-between py-2">
                      <span className="text-gray-500">{fmtDate(p.date)} · {p.method}</span>
                      <span className="font-medium text-green-700">{formatINR(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}
