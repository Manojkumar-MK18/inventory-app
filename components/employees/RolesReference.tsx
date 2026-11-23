"use client";

import { MODULES } from "@/lib/permissions";
import { ROLE_META, ROLE_PRESETS, type AppRole } from "@/lib/roles";

const ROLES: AppRole[] = ["OWNER", "MANAGER", "CASHIER", "SALES", "STOCK", "ACCOUNTANT"];

function levelFor(role: AppRole, moduleKey: string): "edit" | "view" | "none" {
  if (role === "OWNER") return "edit";
  const lvl = ROLE_PRESETS[role as Exclude<AppRole, "OWNER">]?.[moduleKey];
  return (lvl as "edit" | "view" | "none") ?? "none";
}

const CELL = {
  edit: <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Edit</span>,
  view: <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">View</span>,
  none: <span className="text-gray-300">—</span>,
};

export function RolesReference() {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-card">
      <div className="mb-5">
        <h2 className="text-base font-bold text-gray-900">Default roles & access</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          What each role can do by default. Picking a role when adding a worker pre-fills this — you can still fine-tune per person.
        </p>
      </div>

      {/* Role descriptions */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r} className="rounded-2xl border border-gray-200 p-3">
            <p className="text-sm font-semibold text-gray-900">{ROLE_META[r].label}</p>
            <p className="text-xs font-medium text-gray-400">{ROLE_META[r].who}</p>
            <p className="mt-1 text-xs text-gray-500">{ROLE_META[r].job}</p>
          </div>
        ))}
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Menu</th>
              {ROLES.map((r) => (
                <th key={r} className="px-3 py-2 text-center text-xs font-bold text-gray-600">{ROLE_META[r].label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {MODULES.map((m) => (
              <tr key={m.key}>
                <td className="sticky left-0 bg-white px-3 py-2 font-medium text-gray-700">{m.label}</td>
                {ROLES.map((r) => (
                  <td key={r} className="px-3 py-2 text-center">{CELL[levelFor(r, m.key)]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
