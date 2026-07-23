/**
 * Test: CommandPalette hides forbidden pages immediately after a role change
 *
 * Verifies that when the auth context switches to a lower-privilege role,
 * the command palette removes restricted pages from both the "Recent" section
 * and the "All Pages" section without requiring a page reload.
 */
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { useState } from "react";
import { CommandPalette } from "../Topbar";
import { getRecentKey } from "@/lib/recentHistory";

/* ── Mocks ──────────────────────────────────────────────────── */

// Auth — we expose a setter so individual tests can drive role changes
let mockUser: { id: number; role: string } | null = null;

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Wouter — minimal stubs; CommandPalette only needs useLocation
vi.mock("wouter", () => ({
  useLocation: () => ["/dashboard", vi.fn()],
  Link: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

// TanStack Query — not used inside CommandPalette but imported at module level
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// Framer Motion — replace animated wrappers with plain divs/fragments so
// AnimatePresence doesn't swallow children in the jsdom environment
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_t, tag: string) =>
        // eslint-disable-next-line react/display-name
        ({ children, ...rest }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) =>
          React.createElement(tag, rest, children),
    }
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// Radix ScrollArea — pass through so content is always visible in jsdom
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  ScrollBar: () => null,
}));

/* ── Helper: controllable wrapper ───────────────────────────── */

/**
 * Renders CommandPalette (always open) with a role that can be toggled via
 * the returned `setRole` callback, which updates `mockUser` and re-renders.
 */
function renderWithRoleControl(initialRole: string) {
  const userId = 1;

  function Wrapper() {
    const [role, setRoleState] = useState(initialRole);
    // Keep mockUser in sync with local state so useAuth() sees the new role
    mockUser = { id: userId, role };
    return (
      <>
        <button
          data-testid="change-role"
          onClick={() => {
            const next = role === "admin" ? "warehouse" : "admin";
            mockUser = { id: userId, role: next };
            setRoleState(next);
          }}
        />
        <CommandPalette open onClose={vi.fn()} />
      </>
    );
  }

  return { ...render(React.createElement(Wrapper)), userId };
}

/**
 * Renders CommandPalette with independently controllable `open` and `role`
 * state. Exposes buttons so tests can toggle each without coupling them.
 */
function renderWithRoleAndOpenControl(initialRole: string, initialOpen: boolean) {
  const userId = 1;

  function Wrapper() {
    const [role, setRoleState] = useState(initialRole);
    const [open, setOpen] = useState(initialOpen);
    // Keep mockUser in sync with local state so useAuth() sees the new role
    mockUser = { id: userId, role };
    return (
      <>
        <button
          data-testid="change-role"
          onClick={() => {
            const next = role === "admin" ? "warehouse" : "admin";
            mockUser = { id: userId, role: next };
            setRoleState(next);
          }}
        />
        <button
          data-testid="toggle-open"
          onClick={() => setOpen((prev) => !prev)}
        />
        <CommandPalette open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  return { ...render(React.createElement(Wrapper)), userId };
}

/* ── Tests ──────────────────────────────────────────────────── */

describe("CommandPalette – role-change filtering", () => {
  const userId = 1;

  beforeEach(() => {
    // Start with a clean localStorage slate
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    mockUser = null;
    vi.clearAllMocks();
  });

  it("removes a restricted page from Recent when role drops to one without access", async () => {
    // Seed localStorage: admin recently visited /admin/users (User Management)
    const recentEntry = [
      { href: "/admin/users", label: "User Management", section: "Admin" },
    ];
    localStorage.setItem(getRecentKey(userId), JSON.stringify(recentEntry));

    mockUser = { id: userId, role: "admin" };

    // Render as admin — User Management should appear in Recent
    const { getByTestId } = renderWithRoleControl("admin");

    // "User Management" appears in both Recent and All Pages for admin
    expect(screen.getAllByText("User Management").length).toBeGreaterThan(0);

    // Simulate role change to warehouse (no access to /admin/users)
    await act(async () => {
      getByTestId("change-role").click();
    });

    // After the role drop, it must be gone from both sections
    expect(screen.queryByText("User Management")).not.toBeInTheDocument();
  });

  it("keeps permitted pages visible after role change", async () => {
    // Seed localStorage: admin recently visited /procurement/pos
    const recentEntry = [
      { href: "/procurement/pos", label: "Purchase Orders", section: "Procurement" },
    ];
    localStorage.setItem(getRecentKey(userId), JSON.stringify(recentEntry));

    mockUser = { id: userId, role: "admin" };

    const { getByTestId } = renderWithRoleControl("admin");

    // warehouse role is allowed to see Purchase Orders
    await act(async () => {
      getByTestId("change-role").click();
    });

    expect(screen.getAllByText("Purchase Orders").length).toBeGreaterThan(0);
  });

  it("removes restricted pages from All Pages after role change", async () => {
    mockUser = { id: userId, role: "admin" };

    const { getByTestId } = renderWithRoleControl("admin");

    // Admin can see Audit Logs in All Pages
    expect(screen.getByText("Audit Logs")).toBeInTheDocument();

    // Switch to warehouse — Audit Logs should vanish
    await act(async () => {
      getByTestId("change-role").click();
    });

    expect(screen.queryByText("Audit Logs")).not.toBeInTheDocument();
  });

  it("still shows Dashboard (unrestricted page) after role change", async () => {
    mockUser = { id: userId, role: "admin" };

    const { getByTestId } = renderWithRoleControl("admin");

    await act(async () => {
      getByTestId("change-role").click();
    });

    // Dashboard has no roles restriction — visible to every authenticated user
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("forbidden Recent entry stays absent when palette is closed then reopened under demoted role", async () => {
    // Seed localStorage with an admin-only page so it will appear in Recent
    // when the palette is initially opened as admin.
    const recentEntry = [
      { href: "/admin/users", label: "User Management", section: "Admin" },
    ];
    localStorage.setItem(getRecentKey(userId), JSON.stringify(recentEntry));

    mockUser = { id: userId, role: "admin" };

    // Open the palette as admin — the forbidden entry should be visible.
    const { getByTestId } = renderWithRoleAndOpenControl("admin", true);
    expect(screen.getAllByText("User Management").length).toBeGreaterThan(0);

    // Demote to warehouse while the palette is still open.
    await act(async () => {
      getByTestId("change-role").click();
    });

    // Entry must already be gone before we close.
    expect(screen.queryByText("User Management")).not.toBeInTheDocument();

    // Close the palette (open → false).
    await act(async () => {
      getByTestId("toggle-open").click();
    });

    // The stale localStorage entry is still there — the role change did NOT
    // clear it. This is the critical risk: if the useEffect([open, userId])
    // re-reads storage without filtering on re-open, the entry could reappear.
    expect(localStorage.getItem(getRecentKey(userId))).not.toBeNull();

    // Reopen the palette under the demoted (warehouse) role.
    await act(async () => {
      getByTestId("toggle-open").click();
    });

    // The forbidden entry must still be absent — the palette must filter
    // against the current role when it loads Recent from localStorage.
    expect(screen.queryByText("User Management")).not.toBeInTheDocument();
  });
});
