/**
 * Task #229 — VendorsList crash guard
 *
 * Root cause: `placeholderData: (prev) => prev` in queryClient.ts returns
 * `undefined` on first load (no prior cache). Orval-generated hooks return
 * `TData | undefined` — they don't guarantee an array. Calling `.filter()`
 * directly on undefined (or a paginated envelope object) crashes with
 * "vendors.filter is not a function".
 *
 * The fix (line 309 in VendorsList.tsx, added in Task #228 and audited here):
 *   const vendors = Array.isArray(rawVendors) ? rawVendors : [];
 *
 * These tests mount VendorsList with the hook returning several non-array
 * shapes and confirm no uncaught TypeError is thrown.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import VendorsList from "@/pages/procurement/VendorsList";

// ── Mocks ────────────────────────────────────────────────────────────────────

// api-client-react — override useGetVendors per test
const mockUseGetVendors = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  useGetVendors:          (...args: unknown[]) => mockUseGetVendors(...args),
  useCreateVendor:        () => ({ mutate: vi.fn(), isPending: false }),
  getGetVendorsQueryKey:  () => ["/api/vendors"],
}));

// Wouter — VendorsList needs useLocation + setLocation
vi.mock("wouter", () => ({
  useLocation: () => ["/procurement/vendors", vi.fn()],
  Link: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

// TanStack Query — no real QueryClient needed for this unit test
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: () => ({ data: undefined, isLoading: false, isPending: false }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  QueryClient: class {},
}));

// Permissions — always grant everything so the Add Vendor button renders
vi.mock("@/lib/permissions", () => ({
  usePermissions: () => ({
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canApprove: true,
    canExport: true,
  }),
  CanCreate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CanExport: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Toast — avoid portal errors in jsdom
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// date-fns — used for "thisMonth" stat; stub to avoid Date edge cases
vi.mock("date-fns", async () => {
  const real = await vi.importActual<typeof import("date-fns")>("date-fns");
  return { ...real };
});

// Framer Motion — replace animated wrappers with plain divs
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_t, tag: string) =>
        ({
          children,
          ...rest
        }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) =>
          React.createElement(tag === "div" ? "div" : "span", rest, children),
    },
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Shared components — stub heavy UI pieces that pull in radix portals
vi.mock("@/components/shared", () => ({
  EmptyState: ({ heading, title }: { heading?: string; title?: string }) => (
    <div data-testid="empty-state">{heading ?? title}</div>
  ),
  SkeletonCards: () => <div data-testid="skeleton-cards" />,
  ExportButton: () => <button>Export</button>,
  ResponsiveDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    <button onClick={onClick}>{children}</button>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function setHookReturn(data: unknown, extra: Record<string, unknown> = {}) {
  mockUseGetVendors.mockReturnValue({
    data,
    isLoading: false,
    isError:   false,
    error:     null,
    refetch:   vi.fn(),
    ...extra,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("VendorsList — Array.isArray guard prevents crashes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing when data is undefined (first load, no cache)", () => {
    setHookReturn(undefined);
    expect(() => render(<VendorsList />)).not.toThrow();
    // Should show the empty-state fallback, not an error
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders without crashing when data is null (explicit null response)", () => {
    setHookReturn(null);
    expect(() => render(<VendorsList />)).not.toThrow();
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders without crashing when data is a paginated envelope object", () => {
    // Some APIs return { data: [...], total: N } instead of a raw array.
    // A stale placeholderData from another query could have this shape.
    setHookReturn({ data: [{ id: 1, name: "Test Co", status: "Active" }], total: 1 });
    expect(() => render(<VendorsList />)).not.toThrow();
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders without crashing when data is an empty array", () => {
    setHookReturn([]);
    expect(() => render(<VendorsList />)).not.toThrow();
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders vendor names when data is a valid array", () => {
    setHookReturn([
      { id: 1, name: "Waaree Energies", status: "Active",  poCount: 3 },
      { id: 2, name: "Adani Solar",     status: "Inactive", poCount: 0 },
    ]);
    expect(() => render(<VendorsList />)).not.toThrow();
    expect(screen.getByText("Waaree Energies")).toBeInTheDocument();
    expect(screen.getByText("Adani Solar")).toBeInTheDocument();
  });

  it("shows loading skeleton when isLoading is true regardless of data shape", () => {
    setHookReturn(undefined, { isLoading: true });
    expect(() => render(<VendorsList />)).not.toThrow();
    expect(screen.getByTestId("skeleton-cards")).toBeInTheDocument();
  });
});
