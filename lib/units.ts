/** Common selling units for Indian retail. `pcs` is the default. */
export const UNITS = ["pcs", "kg", "g", "ltr", "ml", "box", "pack", "dozen", "mtr"] as const;
export type Unit = (typeof UNITS)[number];

/** GST rate slabs shown in dropdowns. */
export const GST_RATES = [0, 5, 12, 18, 28] as const;

/** Common expense categories for the expenses screen. */
export const EXPENSE_CATEGORIES = ["Rent", "Salary", "Electricity", "Transport", "Supplies", "Misc"] as const;
