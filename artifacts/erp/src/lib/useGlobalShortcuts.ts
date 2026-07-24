/**
 * useGlobalShortcuts — Gmail-style keyboard navigation for Mystics ERP
 *
 * Shortcuts:
 *   ⌘K / Ctrl+K     → Command palette (handled in Topbar, not here)
 *   ?               → Show shortcuts cheat-sheet
 *   g d             → Dashboard
 *   g l             → Leads
 *   g q             → Quotations (CRM)
 *   g p             → Projects
 *   g v             → Vendors
 *   g o             → Purchase Orders
 *   g r             → GRNs
 *   g i             → Inventory / Warehouses
 *   g a             → Approvals
 *   g f             → Finance Dashboard
 *   Escape          → Close any open dialog / go back to list
 */
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const GO_MAP: Record<string, string> = {
  d: "/dashboard",
  l: "/crm/leads",
  q: "/crm/quotations",
  p: "/projects",
  v: "/procurement/vendors",
  o: "/procurement/pos",
  r: "/procurement/grns",
  i: "/inventory/warehouses",
  a: "/approvals",
  f: "/finance/dashboard",
};

type ShortcutsOptions = {
  onToggleCheatsheet: () => void;
  /** Whether a modal/dialog/input is focused — shortcuts are suppressed */
  paletteOpen?: boolean;
};

export function useGlobalShortcuts({ onToggleCheatsheet, paletteOpen }: ShortcutsOptions) {
  const [, navigate] = useLocation();
  const pendingG = useRef(false);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearPending = () => {
      pendingG.current = false;
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    };

    const handler = (e: KeyboardEvent) => {
      // Never fire inside inputs, textareas, selects, contenteditable or modals
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        (e.target as HTMLElement)?.isContentEditable;
      if (isEditable || paletteOpen) { clearPending(); return; }

      // Ignore modifier-key combos (⌘K handled in Topbar)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // ? → toggle cheat-sheet
      if (key === "?" || e.key === "?") {
        e.preventDefault();
        onToggleCheatsheet();
        clearPending();
        return;
      }

      // "g" prefix — start a two-key sequence
      if (key === "g" && !pendingG.current) {
        pendingG.current = true;
        // Auto-cancel after 1.5 s if no second key arrives
        pendingTimer.current = setTimeout(clearPending, 1500);
        return;
      }

      // Second key of "g ?" sequence
      if (pendingG.current) {
        clearPending();
        const dest = GO_MAP[key];
        if (dest) {
          e.preventDefault();
          navigate(dest);
        }
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      clearPending();
    };
  }, [navigate, onToggleCheatsheet, paletteOpen]);
}

/** Data shown in the cheat-sheet modal */
export const SHORTCUT_GROUPS = [
  {
    label: "Navigation (press g, then…)",
    shortcuts: [
      { keys: ["g", "d"], description: "Dashboard" },
      { keys: ["g", "l"], description: "Leads" },
      { keys: ["g", "q"], description: "Quotations (CRM)" },
      { keys: ["g", "p"], description: "Projects" },
      { keys: ["g", "v"], description: "Vendors" },
      { keys: ["g", "o"], description: "Purchase Orders" },
      { keys: ["g", "r"], description: "GRNs" },
      { keys: ["g", "i"], description: "Inventory" },
      { keys: ["g", "a"], description: "Approvals" },
      { keys: ["g", "f"], description: "Finance Dashboard" },
    ],
  },
  {
    label: "Global",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Open command palette" },
      { keys: ["?"],       description: "Show this shortcuts guide" },
      { keys: ["Esc"],     description: "Close modals / go back" },
    ],
  },
];
