const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** Convert Latin digits (0-9) in a string/number to Arabic-Indic numerals. */
export function toArabicIndic(value: string | number): string {
  return String(value).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
}

/**
 * Format a number as Arabic currency text: 12345.6 -> "١٢٣٤٥,٦٠"
 * Uses Arabic-Indic numerals with a comma as the decimal separator,
 * matching the official TVTC forms.
 */
export function formatCurrencyArabic(value: number, decimals = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  const fixed = safe.toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  return `${toArabicIndic(intPart)}${decPart ? `,${toArabicIndic(decPart)}` : ""}`;
}

/** Round to 2 decimal places avoiding floating point drift. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Convert an HTML date input value (yyyy-mm-dd) to dd/mm/yyyy. */
export function formatDateDDMMYYYY(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

/** Convert a dd/mm/yyyy date string back into an HTML date input value (yyyy-mm-dd). */
export function inputDateFromDDMMYYYY(dateStr: string): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return dateStr;
  const [d, m, y] = parts.map((p) => p.trim());
  if (!y || !m || !d) return dateStr;
  return `${y}-${m}-${d}`;
}

/** Today's date as an HTML date input value (yyyy-mm-dd). */
export function todayInputValue(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/** Generate a human-friendly request number like REQ-20260801-1230. */
export function generateRequestNo(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `REQ-${y}${m}${d}-${h}${min}`;
}
