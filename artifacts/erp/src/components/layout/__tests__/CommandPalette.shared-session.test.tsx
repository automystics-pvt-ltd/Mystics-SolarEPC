/**
 * Test: Recent history stays separate when two users share the same browser session
 *
 * Simulates the shared-device flow:
 *   1. User A logs in and navigates to several pages → entries land in their
 *      per-user localStorage bucket.
 *   2. User A logs out (auth.logout calls clearRecentEntries(userA.id)).
 *   3. User B logs in → palette shows NO recent items (different bucket, still empty).
 *   4. User A logs back in → their original history reappears.
 *
 * The per-user isolation is implemented in recentHistory.ts via
 * `getRecentKey(userId)` which namespaces every entry under
 * `mystics_cmd_recent_<userId>`.
 */
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { useState } from "react";
import { CommandPalette } from "../Topbar";
import {
  addRecentEntry,
  clearRecentEntries,
  getRecentEntries,
  getRecentKey,
} from "@/lib/recentHistory";

/* ── Mocks ──────────────────────────────────────────────────── */

// Auth — driven by a module-level variable so individual tests can swap users
let mockUser: { id: number; role: string } | null = null;

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Wouter — minimal stub; CommandPalette only needs useLocation
vi.mock("wouter", () => ({
  useLocation: () => ["/dashboard", vi.fn()],
  Link: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

// TanStack Query — not used inside CommandPalette itself
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// Framer Motion — replace animated wrappers with plain elements so
// AnimatePresence doesn't swallow children in jsdom
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_t, tag: string) =>
        ({
          children,
          ...rest
        }: React.HTMLAttributes<HTMLElement> & {
          children?: React.ReactNode;
        }) =>
          React.createElement(tag, rest, children),
    }
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// Radix ScrollArea — pass through so content is always in the DOM
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  ScrollBar: () => null,
}));

/* ── Helpers ─────────────────────────────────────────────────── */

const USER_A = { id: 1, role: "admin" as const };
const USER_B = { id: 2, role: "admin" as const };

/**
 * Renders CommandPalette (always open) bound to the current mockUser.
 * Returns a rerender() helper that accepts an updated userId so tests
 * can simulate the login → logout → login-as-other-user sequence.
 */
function renderPalette() {
  let setUserIdExternal: (id: number | null) => void;

  function Wrapper() {
    const [_userId, setUserId] = useState<number | null>(mockUser?.id ?? null);
    setUserIdExternal = (id) => {
      mockUser = id !== null ? { id, role: "admin" } : null;
      setUserId(id);
    };
    // Keep mockUser in sync with what useAuth() returns
    mockUser = _userId !== null ? { id: _userId, role: "admin" } : null;
    return <CommandPalette open onClose={vi.fn()} />;
  }

  const utils = render(React.createElement(Wrapper));

  const switchUser = async (user: typeof USER_A | null) => {
    await act(async () => {
      setUserIdExternal(user?.id ?? null);
    });
  };

  return { ...utils, switchUser };
}

/* ── Unit-level tests for recentHistory functions ────────────── */

describe("recentHistory – per-user localStorage isolation", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("stores entries under separate keys for each user", () => {
    addRecentEntry(USER_A.id, "/procurement/pos", "Purchase Orders", "Procurement");
    addRecentEntry(USER_B.id, "/procurement/grns", "GRNs", "Procurement");

    const aEntries = getRecentEntries(USER_A.id);
    const bEntries = getRecentEntries(USER_B.id);

    expect(aEntries.map((e) => e.href)).toContain("/procurement/pos");
    expect(aEntries.map((e) => e.href)).not.toContain("/procurement/grns");

    expect(bEntries.map((e) => e.href)).toContain("/procurement/grns");
    expect(bEntries.map((e) => e.href)).not.toContain("/procurement/pos");
  });

  it("clearRecentEntries only removes the target user's history", () => {
    addRecentEntry(USER_A.id, "/procurement/pos", "Purchase Orders", "Procurement");
    addRecentEntry(USER_B.id, "/procurement/grns", "GRNs", "Procurement");

    // Simulate User A logging out
    clearRecentEntries(USER_A.id);

    expect(getRecentEntries(USER_A.id)).toHaveLength(0);
    // User B's history must be unaffected
    expect(getRecentEntries(USER_B.id)).toHaveLength(1);
  });

  it("User A's history survives User B's session and clear", () => {
    addRecentEntry(USER_A.id, "/procurement/pos", "Purchase Orders", "Procurement");

    // User B browses then clears on logout
    addRecentEntry(USER_B.id, "/dashboard", "Dashboard", "Core");
    clearRecentEntries(USER_B.id);

    // User A logs back in — history still intact
    const aEntries = getRecentEntries(USER_A.id);
    expect(aEntries.map((e) => e.href)).toContain("/procurement/pos");
  });

  it("uses user-scoped localStorage keys", () => {
    expect(getRecentKey(USER_A.id)).toBe(`mystics_cmd_recent_${USER_A.id}`);
    expect(getRecentKey(USER_B.id)).toBe(`mystics_cmd_recent_${USER_B.id}`);
    expect(getRecentKey(USER_A.id)).not.toBe(getRecentKey(USER_B.id));
  });
});

/* ── Component-level: full shared-session flow ───────────────── */

describe("CommandPalette – shared-device history isolation", () => {
  beforeEach(() => {
    localStorage.clear();
    mockUser = null;
  });

  afterEach(() => {
    localStorage.clear();
    mockUser = null;
    vi.clearAllMocks();
  });

  it("User B sees an empty Recent section after User A logs out", async () => {
    // Seed User A's history directly (simulates prior browsing)
    localStorage.setItem(
      getRecentKey(USER_A.id),
      JSON.stringify([
        { href: "/procurement/pos", label: "Purchase Orders", section: "Procurement" },
        { href: "/procurement/grns", label: "GRNs", section: "Procurement" },
      ])
    );

    // Start as User A — palette shows their recent items
    mockUser = USER_A;
    const { switchUser } = renderPalette();

    expect(screen.getAllByText("Purchase Orders").length).toBeGreaterThan(0);

    // --- Logout: auth.logout calls clearRecentEntries(USER_A.id) ---
    clearRecentEntries(USER_A.id);

    // --- Login as User B (fresh account, no browsing history) ---
    await switchUser(USER_B);

    // The "Recent" section heading must not be visible for User B
    expect(screen.queryByText("Recent")).not.toBeInTheDocument();

    // User A's specific pages must not appear in User B's palette either
    // (they may still appear under "All Pages" for roles that allow them,
    // but they must NOT appear in the Recent section — no "recent-…" keyed row)
    const recentSection = screen.queryByText("Recent");
    expect(recentSection).toBeNull();
  });

  it("User A's history reappears when they log back in after User B's session", async () => {
    // Seed User A's history (as if they had browsed before logging out)
    localStorage.setItem(
      getRecentKey(USER_A.id),
      JSON.stringify([
        { href: "/procurement/pos", label: "Purchase Orders", section: "Procurement" },
      ])
    );

    // Start palette as User B (no history)
    mockUser = USER_B;
    const { switchUser } = renderPalette();

    // User B has no recent items
    expect(screen.queryByText("Recent")).not.toBeInTheDocument();

    // User B browses and then logs out
    addRecentEntry(USER_B.id, "/dashboard", "Dashboard", "Core");
    clearRecentEntries(USER_B.id);

    // User A logs back in
    await switchUser(USER_A);

    // "Recent" section must now appear with User A's original entry
    expect(screen.getByText("Recent")).toBeInTheDocument();
    // Purchase Orders appears in the Recent section (it is keyed "recent-/procurement/pos")
    const recentItems = screen.getAllByText("Purchase Orders");
    expect(recentItems.length).toBeGreaterThan(0);
  });

  it("User A's items do NOT appear in User B's palette even without an explicit logout-clear", async () => {
    // Simulate a scenario where only the token was swapped (paranoia check).
    // Even if clearRecentEntries was somehow skipped, User B's ID has no entries.
    localStorage.setItem(
      getRecentKey(USER_A.id),
      JSON.stringify([
        { href: "/admin/users", label: "User Management", section: "Admin" },
      ])
    );
    // No entry set for USER_B.id at all

    mockUser = USER_B;
    renderPalette();

    // User B's palette reads getRecentEntries(USER_B.id) → empty array
    expect(screen.queryByText("Recent")).not.toBeInTheDocument();
    // "User Management" may appear under All Pages (both are admins) but must
    // not appear in a "Recent" section row for User B
    expect(screen.queryByText("Recent")).toBeNull();
  });
});
