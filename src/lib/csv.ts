/**
 * CSV untuk Ekspor (PLAN §6.3). Pemisah koma, baris CRLF, dan BOM UTF-8
 * supaya Excel dan Google Sheets membaca huruf non-ASCII dengan benar. Uang
 * diekspor sebagai angka polos (1400000) supaya bisa dihitung di spreadsheet.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Cegah formula injection saat dibuka di spreadsheet.
  if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
