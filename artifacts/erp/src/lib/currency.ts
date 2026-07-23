/**
 * Currency formatting utilities for Mystics ERP
 *
 * All amounts are in Indian Rupees (INR). Three variants cover every use-case:
 *
 *   formatINR        — full locale string  e.g. ₹12,34,567  (tables, tooltips, detail views)
 *   formatINRCompact — human-readable      e.g. ₹1.20 Cr / ₹45.6 L / ₹1.5k  (KPI cards, lists)
 *   formatINRAxis    — chart axis labels   e.g. ₹1Cr / ₹45L / ₹1k  (Recharts YAxis tick)
 */

const LOCALE = "en-IN";

/** Full INR locale string: ₹12,34,567 */
export function formatINR(v?: number | null): string {
  if (v == null || isNaN(v)) return "₹0";
  return v.toLocaleString(LOCALE, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

/** Compact notation for cards and lists: ₹1.20 Cr / ₹45.6 L / ₹1.5k */
export function formatINRCompact(v?: number | null): string {
  if (v == null || isNaN(v)) return "₹0";
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)} Cr`;
  if (v >= 100_000)    return `₹${(v / 100_000).toFixed(1)} L`;
  if (v >= 1_000)      return `₹${(v / 1_000).toFixed(1)}k`;
  return `₹${v.toLocaleString(LOCALE, { maximumFractionDigits: 0 })}`;
}

/** Short axis labels for Recharts (less decimal precision): ₹1Cr / ₹45L / ₹1k */
export function formatINRAxis(v?: number | null): string {
  if (v == null || isNaN(v)) return "₹0";
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1)}Cr`;
  if (v >= 100_000)    return `₹${(v / 100_000).toFixed(0)}L`;
  if (v >= 1_000)      return `₹${(v / 1_000).toFixed(0)}k`;
  return `₹${v.toLocaleString(LOCALE, { maximumFractionDigits: 0 })}`;
}
