"use client";

import * as XLSX from "xlsx";

export type ExcelSheet = {
  name: string;
  rows: Record<string, string | number | null | undefined>[];
  /** Optional column order */
  columns?: string[];
};

function sheetFromRows(
  rows: Record<string, string | number | null | undefined>[],
  columns?: string[]
): XLSX.WorkSheet {
  if (!rows.length) {
    return XLSX.utils.aoa_to_sheet([["No data"]]);
  }
  const cols = columns?.length ? columns : Object.keys(rows[0]);
  const aoa: (string | number | null)[][] = [
    cols,
    ...rows.map((row) => cols.map((c) => (row[c] == null ? "" : row[c]))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = cols.map((c) => ({
    wch: Math.min(
      36,
      Math.max(
        c.length + 2,
        ...rows.map((r) => String(r[c] ?? "").length + 1)
      )
    ),
  }));
  return ws;
}

/** Download one or more sheets as .xlsx */
export function downloadExcel(filename: string, sheets: ExcelSheet[]) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const safeName = sheet.name.replace(/[\\/?*[\]]/g, " ").slice(0, 31) || "Sheet1";
    const ws = sheetFromRows(sheet.rows, sheet.columns);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const name = filename.endsWith(".xlsx")
    ? filename
    : `${filename}-${stamp}.xlsx`;
  XLSX.writeFile(wb, name);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
