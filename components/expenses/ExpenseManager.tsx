"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { createExpense, type ExpenseDTO } from "@/actions/expenses";
import { EXPENSE_CATEGORIES } from "@/lib/units";
import { formatINR } from "@/lib/money";

export function ExpenseManager({ initial }: { initial: ExpenseDTO[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return initial.filter((e) => {
      const matchQ = !query || e.category.toLowerCase().includes(query) || (e.note ?? "").toLowerCase().includes(query);
      const matchCat = !cat || e.category === cat;
      return matchQ && matchCat;
    });
  }, [initial, q, cat]);

  const total = filtered.reduce((a, e) => a + e.amount, 0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const f = new FormData(e.currentTarget);
    const res = await createExpense({ category: f.get("category"), amountRupees: f.get("amountRupees"), note: f.get("note") || "" });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    (e.target as HTMLFormElement).reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <span className="text-xs uppercase tracking-wide text-gray-400">Total (shown)</span>
          <span className="ml-3 text-xl font-semibold">{formatINR(total)}</span>
        </div>
        <button onClick={() => setOpen((s) => !s)} className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white">
          <Plus size={16} /> Add expense
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search category or note…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {(q || cat) && (
          <button onClick={() => { setQ(""); setCat(""); }} className="rounded-lg border px-3 py-2 text-sm">Clear</button>
        )}
      </div>

      {open && (
        <form onSubmit={onSubmit} className="grid max-w-xl grid-cols-2 gap-3 rounded-xl border border-gray-200 p-4">
          <select name="category" className="rounded-lg border px-3 py-2 text-sm" defaultValue="Misc">
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input name="amountRupees" type="number" step="0.01" min={1} required placeholder="Amount ₹" className="rounded-lg border px-3 py-2 text-sm" />
          <input name="note" placeholder="Note (optional)" className="col-span-2 rounded-lg border px-3 py-2 text-sm" />
          {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
          <button disabled={saving} className="col-span-2 rounded-xl bg-gray-900 py-2 text-sm text-white disabled:opacity-50">{saving ? "Saving…" : "Save expense"}</button>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Note</th><th className="px-4 py-3 text-right">Amount</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">{initial.length === 0 ? "No expenses yet." : "No matches."}</td></tr>}
            {filtered.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{new Date(e.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" } as any)}</td>
                <td className="px-4 py-3 font-medium">{e.category}</td>
                <td className="px-4 py-3 text-gray-500">{e.note || "—"}</td>
                <td className="px-4 py-3 text-right font-medium">{formatINR(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
