/**
 * Currency formatting utilities for Solar EPC — Indian Rupees (INR / en-IN)
 *
 * We manually prepend ₹ and use toLocaleString only for digit grouping
 * (lakhs / crores) so the symbol is always correct regardless of whether
 * the runtime has full ICU data (Replit's Node does not).
 *
 *   formatINR        — ₹12,34,567       tables, tooltips, detail views
 *   formatINRCompact — ₹1.20 Cr / ₹45.6 L / ₹1.5k   KPI cards, lists
 *   formatINRAxis    — ₹1Cr / ₹45L / ₹1k             Recharts YAxis ticks
 */

const LOCALE = "en-IN";

/** Full locale string with en-IN digit grouping: ₹12,34,567 */
export function formatINR(v?: number | null): string {
  if (v == null || isNaN(v)) return "₹0";
  return `₹${v.toLocaleString(LOCALE, { maximumFractionDigits: 0 })}`;
}

/** Compact human-readable: ₹1.20 Cr / ₹45.6 L / ₹1.5k */
export function formatINRCompact(v?: number | null): string {
  if (v == null || isNaN(v)) return "₹0";
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)} Cr`;
  if (v >= 100_000)    return `₹${(v / 100_000).toFixed(1)} L`;
  if (v >= 1_000)      return `₹${(v / 1_000).toFixed(1)}k`;
  return `₹${v.toLocaleString(LOCALE, { maximumFractionDigits: 0 })}`;
}

/** Short axis labels for Recharts: ₹1Cr / ₹45L / ₹1k */
export function formatINRAxis(v?: number | null): string {
  if (v == null || isNaN(v)) return "₹0";
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1)}Cr`;
  if (v >= 100_000)    return `₹${(v / 100_000).toFixed(0)}L`;
  if (v >= 1_000)      return `₹${(v / 1_000).toFixed(0)}k`;
  return `₹${v.toLocaleString(LOCALE, { maximumFractionDigits: 0 })}`;
}
