/**
 * Shared utility for tracking recently-visited pages in the command palette.
 *
 * Entries can be either list pages (matching ALL_NAV) or detail pages
 * (e.g. /procurement/pos/42) with a human-readable label and section.
 *
 * The storage key is scoped per user ID so that shared-device users never
 * see each other's navigation history.
 */

export interface RecentEntry {
  href: string;
  /** Human-readable label, e.g. "PO #42" or "Purchase Orders" */
  label: string;
  /** Section subtitle shown in the palette, e.g. "Purchase Orders" or "Procurement" */
  section: string;
}

export const MAX_RECENT = 8;

/** Returns the localStorage key scoped to the given user ID. */
export function getRecentKey(userId: number): string {
  return `mystics_cmd_recent_${userId}`;
}

/**
 * Read recent entries from localStorage for the given user.
 * Handles the legacy format (string[]) and the new RecentEntry[] format.
 */
export function getRecentEntries(userId: number): RecentEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(getRecentKey(userId)) ?? "[]");
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
 * Prepend an entry to the recent list for the given user
 * (deduped by href, capped at MAX_RECENT).
 */
export function addRecentEntry(userId: number, href: string, label: string, section: string) {
  const prev = getRecentEntries(userId).filter((e) => e.href !== href);
  const entry: RecentEntry = { href, label, section };
  localStorage.setItem(
    getRecentKey(userId),
    JSON.stringify([entry, ...prev].slice(0, MAX_RECENT))
  );
}

/**
 * Clear the recent history for the given user.
 * Call this on logout so the next user starts with a clean slate.
 */
export function clearRecentEntries(userId: number) {
  localStorage.removeItem(getRecentKey(userId));
}
