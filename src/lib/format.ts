export function formatBDT(value: number, decimals = 0): string {
  const n = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function formatBDTCurrency(value: number, decimals = 0): string {
  return `৳ ${formatBDT(value, decimals)}`;
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function excelSerialToISO(serial: number): string {
  // Excel serial date (Windows / 1900 date system)
  const utc = Date.UTC(1899, 11, 30) + serial * 86400000;
  return new Date(utc).toISOString().slice(0, 10);
}

export function slugId(prefix: string, value: string): string {
  const clean = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${prefix}-${clean || Math.random().toString(36).slice(2, 8)}`;
}
