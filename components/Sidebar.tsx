"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, Package, Truck,
  ReceiptText, Users, BarChart3, Settings, Wallet, Factory, CalendarCheck, RotateCcw,
  Scissors, ClipboardCheck, UserCog,
} from "lucide-react";
import { Copyright } from "./Brand";
import { can } from "@/lib/permissions";

const SECTIONS = [
  {
    title: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
      { href: "/pos", label: "New Bill", icon: ShoppingCart, module: "pos" },
      { href: "/sales", label: "Sales", icon: ReceiptText, module: "sales" },
      { href: "/returns", label: "Returns & Exchanges", icon: RotateCcw, module: "returns" },
      { href: "/alterations", label: "Alterations", icon: Scissors, module: "alterations" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { href: "/products", label: "Products & Inventory", icon: Package, module: "products" },
      { href: "/purchases", label: "Purchases", icon: Truck, module: "purchases" },
      { href: "/stock-audit", label: "Stock Audit", icon: ClipboardCheck, module: "stock-audit" },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/customers", label: "Customers", icon: Users, module: "customers" },
      { href: "/suppliers", label: "Suppliers", icon: Factory, module: "suppliers" },
    ],
  },
  {
    title: "Business",
    items: [
      { href: "/expenses", label: "Expenses", icon: Wallet, module: "expenses" },
      { href: "/attendance", label: "Attendance", icon: CalendarCheck, module: "attendance" },
      { href: "/reports", label: "Reports", icon: BarChart3, module: "reports" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/employees", label: "Employees & Roles", icon: UserCog, module: "__owner__" }, // owner-only
      { href: "/settings", label: "Settings", icon: Settings, module: "__owner__" }, // owner-only
    ],
  },
] as const;

export function Sidebar({ businessName, role, permissions }: { businessName: string; role: string; permissions: Record<string, string> }) {
  const pathname = usePathname();
  const ctx = { role, permissions };
  const allowed = (module: string) => (module === "__owner__" ? role === "OWNER" : can(ctx, module, "view"));
  const sections = SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((it) => allowed(it.module)) }))
    .filter((s) => s.items.length > 0);

  return (
    <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col border-r border-gray-200/80 bg-gradient-to-b from-white to-gray-50/60">
      {/* Shop identity */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-soft">
          {businessName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight text-gray-900">{businessName}</p>
          <span className="mt-0.5 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold capitalize text-brand-700">
            {role.toLowerCase()}
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
        {sections.map((section, si) => (
          <div key={si} className="flex flex-col gap-1">
            {section.title && (
              <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">{section.title}</p>
            )}
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-all duration-150 ${
                    active
                      ? "bg-brand-100 font-semibold text-brand-800 shadow-[inset_0_0_0_1px_rgba(79,70,229,0.08)]"
                      : "font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <Icon
                    size={20}
                    className={active ? "text-brand-700" : "text-gray-400 group-hover:text-gray-600"}
                  />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-gray-100 px-4 py-3">
        <Copyright />
      </div>
    </aside>
  );
}
