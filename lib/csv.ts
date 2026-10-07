/** Build a CSV string and trigger a browser download. Client-side only. */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Paise -> plain rupee string for spreadsheets (no ₹ symbol). */
export function paiseToCsv(paise: number): string {
  return (paise / 100).toFixed(2);
}

export interface CsvSection {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

/** Build one CSV file with several titled sections (each separated by a blank line). */
export function downloadCsvSections(filename: string, sections: CsvSection[]): void {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines: string[] = [];
  for (const s of sections) {
    lines.push(esc(s.title.toUpperCase()));
    lines.push(s.headers.map(esc).join(","));
    if (s.rows.length === 0) lines.push(esc("(none)"));
    else for (const r of s.rows) lines.push(r.map(esc).join(","));
    lines.push(""); // blank line between sections
  }
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
