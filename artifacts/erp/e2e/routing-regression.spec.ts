/**
 * Routing regression suite — direct URL navigation
 *
 * Purpose
 * -------
 * Verifies that every ERP module URL works when accessed directly (bookmarked
 * or shared link), not just when reached through the NavRail.
 *
 * The VITE_ROUTER_BASE=/erp fix was confirmed for /inventory, /engineering,
 * /oam, and /platform-admin.  This suite extends that coverage to every other
 * module so any future regression is caught before it ships.
 *
 * Strategy
 * --------
 * Each test navigates straight to the target URL with `page.goto(path)` — no
 * warm-up navigation to "/" first.  Playwright restores the auth storageState
 * (written by globalSetup) before each context is created, so localStorage
 * already holds the JWT token; the SPA recognises the authenticated session
 * without an extra round-trip.
 *
 * A route is considered "working" when:
 *   1. The browser does NOT redirect to /login.
 *   2. The page does NOT render the 404 shell ("Page not found" / "404" h1).
 *
 * Auth: admin@automystics.com (all module permissions).
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate directly to `path` — simulating a fresh browser tab opened via a
 * bookmarked or shared URL.  No "/" warm-up; auth comes from storageState.
 */
async function gotoDirectly(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  // Give lazy JS chunks and data fetches a chance to settle.
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
}

/**
 * Assert the page rendered the module content rather than the 404 shell or
 * the login screen.
 */
async function assertNotFoundOrLogin(page: Page, path: string): Promise<void> {
  // Must not have been redirected to the login page.
  await expect(
    page,
    `Route "${path}" redirected to /login — auth state was not restored`,
  ).not.toHaveURL(/\/login/, { timeout: 5_000 });

  // The NotFound component renders an <h1> with text "404".
  // If we find it, the router failed to match the route.
  const notFound404 = page.locator("h1").filter({ hasText: /^404$/ });
  await expect(
    notFound404,
    `Route "${path}" rendered the 404 page — routing broken for direct URL navigation`,
  ).not.toBeVisible({ timeout: 5_000 });

  // Belt-and-suspenders: also check the descriptive text below the "404" heading.
  const notFoundText = page.locator("h2").filter({ hasText: /page not found/i });
  await expect(
    notFoundText,
    `Route "${path}" showed "Page not found" — routing broken for direct URL navigation`,
  ).not.toBeVisible({ timeout: 5_000 });
}

// ---------------------------------------------------------------------------
// Route catalogue
// Every entry is { label, path }.  "label" is used only in the test name.
// ---------------------------------------------------------------------------

const MODULE_ROOTS: Array<{ label: string; path: string }> = [
  // Core
  { label: "Dashboard",                 path: "/dashboard" },
  { label: "Approvals",                 path: "/approvals" },

  // CRM
  { label: "CRM workspace",            path: "/crm" },
  { label: "CRM / Leads",              path: "/crm/leads" },
  { label: "CRM / Quotations",         path: "/crm/quotations" },
  { label: "CRM / Client POs",         path: "/crm/client-pos" },
  { label: "CRM / Invoices",           path: "/crm/invoices" },
  { label: "CRM / Tasks",              path: "/crm/tasks" },
  { label: "CRM / Escalations",        path: "/crm/escalations" },

  // Projects
  { label: "Projects list",            path: "/projects" },
  { label: "Projects / Contractors",   path: "/projects/contractors" },

  // Inventory
  { label: "Inventory dashboard",      path: "/inventory" },
  { label: "Inventory / Stock levels", path: "/inventory/stock-levels" },
  { label: "Inventory / Allocations",  path: "/inventory/allocations" },
  { label: "Inventory / Returns",      path: "/inventory/returns" },
  { label: "Inventory / Reorder",      path: "/inventory/reorder-planning" },
  { label: "Inventory / Warehouses",   path: "/inventory/warehouses" },
  { label: "Inventory / Transfers",    path: "/inventory/stock-transfers" },
  { label: "Inventory / Challans",     path: "/inventory/delivery-challans" },
  { label: "Inventory / Ledger",       path: "/inventory/stock-ledger" },
  { label: "Inventory / Valuation",    path: "/inventory/stock-valuation" },
  { label: "Inventory / Audits",       path: "/inventory/audits" },

  // Engineering
  { label: "Engineering root",         path: "/engineering" },
  { label: "Engineering / Docs",       path: "/engineering/docs" },

  // Commissioning
  { label: "Commissioning list",       path: "/commissioning" },

  // O&M
  { label: "O&M root",                 path: "/oam" },
  { label: "O&M / AMC",               path: "/oam/amc" },
  { label: "O&M / Maintenance",        path: "/oam/maintenance" },
  { label: "O&M / Tickets",            path: "/oam/tickets" },

  // Procurement
  { label: "Procurement dashboard",    path: "/procurement/dashboard" },
  { label: "Procurement / Vendors",    path: "/procurement/vendors" },
  { label: "Procurement / Materials",  path: "/procurement/materials" },
  { label: "Procurement / Quotations", path: "/procurement/quotations" },
  { label: "Procurement / POs",        path: "/procurement/pos" },
  { label: "Procurement / GRNs",       path: "/procurement/grns" },
  { label: "Procurement / GRN Returns",path: "/procurement/grn-returns" },
  { label: "Procurement / Invoices",   path: "/procurement/invoices" },

  // Finance & Reports
  { label: "Finance dashboard",        path: "/finance/dashboard" },
  { label: "Reports root",             path: "/reports" },
  { label: "Reports / Vendor perf",    path: "/reports/vendors" },

  // Platform Admin (own shell — no NavRail)
  { label: "Platform Admin root",      path: "/platform-admin" },

  // Admin
  { label: "Admin / Platform",         path: "/admin/platform" },
  { label: "Admin / Database",         path: "/admin/db" },
  { label: "Admin / Users",            path: "/admin/users" },
  { label: "Admin / Audit Logs",       path: "/admin/audit-logs" },
  { label: "Admin / RBAC",             path: "/admin/rbac" },
];

// ---------------------------------------------------------------------------
// Tests — one per route
// ---------------------------------------------------------------------------

for (const { label, path } of MODULE_ROOTS) {
  test(
    `direct URL navigation: ${label} (${path})`,
    async ({ page }) => {
      await gotoDirectly(page, path);
      await assertNotFoundOrLogin(page, path);
    },
  );
}
