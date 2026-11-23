/**
 * The 6 default roles from spec section C · Roles & Permissions.
 * Each role has a description and a default per-module access preset. The Owner
 * always has full access and is never limited. Owners can fine-tune any menu
 * after picking a role.
 */
import type { Permissions } from "./permissions";

export type AppRole = "OWNER" | "MANAGER" | "CASHIER" | "SALES" | "STOCK" | "ACCOUNTANT";

/** Roles an owner can assign to a worker (everyone except OWNER). */
export const ASSIGNABLE_ROLES: Exclude<AppRole, "OWNER">[] = [
  "MANAGER", "CASHIER", "SALES", "STOCK", "ACCOUNTANT",
];

export const ROLE_META: Record<AppRole, { label: string; who: string; job: string }> = {
  OWNER: { label: "Owner", who: "Shop owner", job: "Everything — settings, profit and staff" },
  MANAGER: { label: "Manager", who: "Store manager", job: "Daily operations, approvals, staff tracking" },
  CASHIER: { label: "Cashier", who: "Counter staff", job: "Billing, payments and returns at the counter" },
  SALES: { label: "Sales Staff", who: "Floor staff", job: "Help customers, create bills, add customers" },
  STOCK: { label: "Stock Manager", who: "Godown / stock person", job: "Products, purchases and stock count" },
  ACCOUNTANT: { label: "Accountant", who: "In-house or part-time", job: "Expenses, payments, GST & reports" },
};

/**
 * Default menu access per role, mapped to the app's MODULES
 * (dashboard, pos, sales, returns, products, purchases, customers, suppliers,
 * expenses, attendance, reports). Based on the spec's role→menu matrix.
 */
export const ROLE_PRESETS: Record<Exclude<AppRole, "OWNER">, Permissions> = {
  MANAGER: {
    dashboard: "view", pos: "edit", sales: "view", returns: "edit", products: "edit",
    purchases: "edit", customers: "edit", suppliers: "edit", expenses: "edit",
    attendance: "view", reports: "view",
  },
  CASHIER: {
    dashboard: "none", pos: "edit", sales: "view", returns: "edit", products: "view",
    purchases: "none", customers: "edit", suppliers: "none", expenses: "none",
    attendance: "view", reports: "none",
  },
  SALES: {
    dashboard: "none", pos: "edit", sales: "view", returns: "none", products: "view",
    purchases: "none", customers: "edit", suppliers: "none", expenses: "none",
    attendance: "view", reports: "none",
  },
  STOCK: {
    dashboard: "none", pos: "none", sales: "none", returns: "none", products: "edit",
    purchases: "edit", customers: "none", suppliers: "view", expenses: "none",
    attendance: "view", reports: "none",
  },
  ACCOUNTANT: {
    dashboard: "view", pos: "none", sales: "view", returns: "none", products: "none",
    purchases: "view", customers: "view", suppliers: "view", expenses: "edit",
    attendance: "view", reports: "view",
  },
};
