"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, Package, Truck,
  ReceiptText, Users, BarChart3, Settings, Wallet, Factory, CalendarCheck, RotateCcw,
} from "lucide-react";
import { Copyright } from "./Brand";

const SECTIONS = [
  {
    title: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/pos", label: "New Bill", icon: ShoppingCart },
      { href: "/sales", label: "Sales", icon: ReceiptText },
      { href: "/returns", label: "Returns", icon: RotateCcw },
    ],
  },
  {
    title: "Inventory",
    items: [
      { href: "/products", label: "Products", icon: Package },
      { href: "/purchases", label: "Purchases", icon: Truck },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/suppliers", label: "Suppliers", icon: Factory },
    ],
  },
  {
    title: "Business",
    items: [
      { href: "/expenses", label: "Expenses", icon: Wallet },
      { href: "/attendance", label: "Attendance", icon: CalendarCheck },
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

export function Sidebar({ businessName, role }: { businessName: string; role: string }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-bold text-white shadow-soft">
          {businessName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight text-gray-900">{businessName}</p>
          <p className="text-xs font-medium capitalize text-gray-400">{role.toLowerCase()}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        {SECTIONS.map((section, si) => (
          <div key={si} className="flex flex-col gap-1">
            {section.title && (
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{section.title}</p>
            )}
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-semibold ${
                    active
                      ? "bg-brand-600 text-white shadow-soft"
                      : "text-gray-700 hover:bg-brand-50 hover:text-brand-700"
                  }`}
                >
                  <Icon size={20} className={active ? "text-white" : "text-gray-400 group-hover:text-brand-600"} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-gray-100 p-3">
        <Copyright />
      </div>
    </aside>
  );
}
