/** Shared shapes for the customer/supplier "view history" dialog. */
export interface PartyHistoryEntry {
  date: string; // ISO
  title: string; // invoice no / supplier invoice / "Purchase"
  detail: string; // e.g. "3 items"
  amount: number; // paise
}

export interface PartyPayment {
  date: string; // ISO
  method: string;
  amount: number; // paise
}

export interface PartyHistory {
  name: string;
  phone: string;
  area: string;
  balanceDue: number; // paise
  entriesLabel: string; // "Bills" (customer) or "Purchases" (supplier)
  entries: PartyHistoryEntry[];
  payments: PartyPayment[];
}
