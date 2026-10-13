/** Shared CSV helpers: RFC-4180 quoting, Excel-friendly BOM, formula-injection guard. */

export type CsvCell = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? `"${value}"` : '""';
  }
  let s = String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header, ...rows].map((r) => r.map(escapeCsvCell).join(','));
  return '\uFEFF' + lines.join('\r\n');
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function timestampedFilename(prefix: string, d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${prefix}_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}.csv`;
}
