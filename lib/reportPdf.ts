import type { FullReport } from "@/actions/reports";

/** Escape text so it is safe inside HTML. */
function esc(v: string | number): string {
  return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function table(headers: string[], rows: (string | number)[][], empty: string): string {
  if (rows.length === 0) return `<p class="empty">${esc(empty)}</p>`;
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * Build a clean, printable HTML report and open the browser's print dialog,
 * where the user chooses "Save as PDF". No external library — works offline.
 */
export function printReportPdf(r: FullReport): void {
  const generated = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

  const summaryRows = r.summary.map((s) => `<tr><td>${esc(s.label)}</td><td class="num">${esc(s.value)}</td></tr>`).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8" />
<title>Report ${esc(r.from)} to ${esc(r.to)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; font-size: 12px; }
  h1 { font-size: 20px; margin: 0; }
  h2 { font-size: 14px; margin: 22px 0 8px; border-bottom: 2px solid #111; padding-bottom: 4px; }
  .sub { color: #666; margin: 2px 0 0; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #ccc; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #f2f2f2; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .summary td:last-child { text-align: right; font-weight: bold; white-space: nowrap; }
  .summary td:first-child { width: 60%; }
  .empty { color: #999; font-style: italic; margin: 6px 0; }
  .foot { margin-top: 28px; color: #999; font-size: 10px; text-align: center; }
  @media print { body { margin: 10mm; } h2 { page-break-after: avoid; } tr { page-break-inside: avoid; } }
</style></head><body>
  <h1>${esc(r.businessName)}</h1>
  <p class="sub">Business Report · ${esc(r.from)} to ${esc(r.to)}</p>

  <h2>Summary</h2>
  <table class="summary"><tbody>${summaryRows}</tbody></table>

  <h2>Sales (${r.sales.length})</h2>
  ${table(r.salesHeaders, r.sales, "No sales in this period.")}

  <h2>Purchases (${r.purchases.length})</h2>
  ${table(["Date", "Supplier", "Invoice #", "Items", "Total cost"], r.purchases, "No purchases in this period.")}

  <h2>Expenses (${r.expenses.length})</h2>
  ${table(["Date", "Category", "Amount", "Note"], r.expenses, "No expenses in this period.")}

  <h2>Attendance (${r.attendance.length})</h2>
  ${table(["Date", "Worker", "First in", "Last out", "Sessions", "Hours", "Status"], r.attendance, "No attendance records.")}

  <h2>Customers — dues (${r.customers.length})</h2>
  ${table(["Name", "Phone", "Area", "Balance due"], r.customers, "No customers.")}

  <h2>Suppliers — dues (${r.suppliers.length})</h2>
  ${table(["Name", "Phone", "Area", "Balance due"], r.suppliers, "No suppliers.")}

  <p class="foot">Generated on ${esc(generated)} · All amounts in ₹ (INR)</p>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Please allow pop-ups for this site to download the PDF report.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Give the new window a moment to render before printing.
  w.onload = () => { w.focus(); w.print(); };
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* onload already fired */ } }, 400);
}
