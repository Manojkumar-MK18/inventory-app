/**
 * Per-menu permissions for staff (Manager / Cashier). The OWNER always has full
 * access and is never limited. Each module can be set to: no access, view, or
 * view + edit. Settings/Staff are owner-only and not grantable here.
 */

export type PermLevel = "none" | "view" | "edit";
export type Permissions = Record<string, PermLevel>;

/** The menus a manager/cashier can be given access to, with the route they map to. */
export const MODULES = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "pos", label: "New Bill (POS)", href: "/pos" },
  { key: "sales", label: "Sales", href: "/sales" },
  { key: "returns", label: "Returns", href: "/returns" },
  { key: "products", label: "Products", href: "/products" },
  { key: "purchases", label: "Purchases", href: "/purchases" },
  { key: "customers", label: "Customers", href: "/customers" },
  { key: "suppliers", label: "Suppliers", href: "/suppliers" },
  { key: "expenses", label: "Expenses", href: "/expenses" },
  { key: "attendance", label: "Attendance", href: "/attendance" },
  { key: "reports", label: "Reports", href: "/reports" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

/** A sensible starter set for a new staff member (cashier-ish): bill + view a few things. */
export const DEFAULT_PERMISSIONS: Permissions = {
  dashboard: "view",
  pos: "edit",
  sales: "view",
  returns: "edit",
  products: "view",
  purchases: "none",
  customers: "view",
  suppliers: "none",
  expenses: "none",
  attendance: "view",
  reports: "none",
};

interface HasRolePerms {
  role: string;
  permissions?: Record<string, string>;
}

/** Can this context VIEW or EDIT a module? Owner = always yes. */
export function can(ctx: HasRolePerms, moduleKey: string, need: "view" | "edit" = "view"): boolean {
  if (ctx.role === "OWNER") return true;
  const lvl = ctx.permissions?.[moduleKey] ?? "none";
  if (lvl === "edit") return true;
  if (lvl === "view") return need === "view";
  return false;
}

/** The first module (by menu order) the user may view — used as their home page. */
export function firstAllowedHref(ctx: HasRolePerms): string {
  if (ctx.role === "OWNER") return "/dashboard";
  for (const m of MODULES) if (can(ctx, m.key, "view")) return m.href;
  return "/pos"; // nothing granted — send to POS (will still be blocked, shows a clear page)
}
