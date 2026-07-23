/**
 * Shared utility for tracking recently-visited pages in the command palette.
 *
 * Entries can be either list pages (matching ALL_NAV) or detail pages
 * (e.g. /procurement/pos/42) with a human-readable label and section.
 */

export interface RecentEntry {
  href: string;
  /** Human-readable label, e.g. "PO #42" or "Purchase Orders" */
  label: string;
  /** Section subtitle shown in the palette, e.g. "Purchase Orders" or "Procurement" */
  section: string;
}

export const RECENT_KEY = "mystics_cmd_recent";
export const MAX_RECENT = 8;

/**
 * Read recent entries from localStorage.
 * Handles the legacy format (string[]) and the new RecentEntry[] format.
 */
export function getRecentEntries(): RecentEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    // Legacy format: string[]
    if (raw.length > 0 && typeof raw[0] === "string") {
      return raw.map((href: string) => ({ href, label: href, section: "" }));
    }
    return raw.filter(
      (e: unknown): e is RecentEntry =>
        !!e && typeof (e as RecentEntry).href === "string"
    );
  } catch {
    return [];
  }
}

/**
 * Prepend an entry to the recent list (deduped by href, capped at MAX_RECENT).
 */
export function addRecentEntry(href: string, label: string, section: string) {
  const prev = getRecentEntries().filter((e) => e.href !== href);
  const entry: RecentEntry = { href, label, section };
  localStorage.setItem(
    RECENT_KEY,
    JSON.stringify([entry, ...prev].slice(0, MAX_RECENT))
  );
}
