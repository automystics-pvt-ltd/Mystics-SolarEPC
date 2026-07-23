/**
 * Currency formatting for Mystics Field App (INR / en-IN)
 */

const LOCALE = 'en-IN';

/** Full INR locale string: ₹12,34,567 */
export function formatINR(v?: number | null): string {
  if (v == null || isNaN(Number(v))) return '₹0';
  return Number(v).toLocaleString(LOCALE, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
}

/** Compact notation: ₹1.20 Cr / ₹45.6 L / ₹1.5k */
export function formatINRCompact(v?: number | null): string {
  if (v == null || isNaN(Number(v))) return '₹0';
  const n = Number(v);
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)} L`;
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}k`;
  return `₹${n.toLocaleString(LOCALE, { maximumFractionDigits: 0 })}`;
}
