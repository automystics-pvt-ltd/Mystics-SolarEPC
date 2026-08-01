/**
 * Mobile responsive smoke tests — 390 × 844 px (iPhone 14)
 *
 * These tests verify the four responsive changes shipped in Task #225:
 *  1. DataTable hides overflow columns on narrow screens — the outer page must
 *     not grow wider than the 390 px viewport.
 *  2. "Add Vendor" opens a bottom Sheet, not a centered Dialog.
 *  3. CRM kanban scrolls horizontally with CSS snap alignment per column.
 *
 * Auth strategy
 * -------------
 * `globalSetup` (see playwright.config.mjs) logs in once and writes the JWT +
 * user-cache to `.auth/state.json`.  Playwright restores that storageState into
 * every new browser context, so tests navigate directly to protected routes
 * without repeating the login round-trip.
 */

import { test, expect, type Page } from "@playwright/test";

// ── Shared navigation helper ───────────────────────────────────────────────────

/**
 * Navigate to a protected page.
 *
 * Auth is already in localStorage (restored from storageState by Playwright).
 * We just need to load the root once so the JS bundle is parsed and the token
 * survives the SPA navigation, then jump to the target path.
 */
async function gotoAuthenticated(page: Page, path: string) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 20_000 });
}

// ── Page-level overflow helper ─────────────────────────────────────────────────

/**
 * Returns true when the HTML root scrolls horizontally at the current
 * viewport width.  The DataTable uses an inner overflow-x-auto wrapper which
 * is EXPECTED to scroll internally; we only care that the outer page does not
 * grow wider than 390 px.
 */
async function pageHasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
}

// ── 1. DataTable — no horizontal overflow ─────────────────────────────────────

const DATA_TABLE_PAGES: Array<{ label: string; path: string }> = [
  { label: "GRNs",       path: "/procurement/grns"     },
  { label: "Invoices",   path: "/procurement/invoices" },
  { label: "Audit Logs", path: "/admin/audit-logs"     },
];

for (const { label, path } of DATA_TABLE_PAGES) {
  test(
    `DataTable on ${label} page — no horizontal overflow at 390 px`,
    async ({ page }) => {
      await gotoAuthenticated(page, path);

      // 1. Assert we are not stuck on the login page (auth must succeed).
      await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });

      // 2. The DataTable always renders a <table> — even in the loading-skeleton
      //    state — when the route is accessible.  Fail explicitly here rather than
      //    swallowing a timeout: a redirect, blank page, or crash will surface as a
      //    clear "table not found" error instead of a silent pass.
      const table = page.locator("table").first();
      await expect(table).toBeVisible({ timeout: 20_000 });

      // 3. Allow a brief moment for layout/paint to settle.
      await page.waitForTimeout(200);

      // 4. The outer page must not require horizontal scrolling.
      const overflows = await pageHasHorizontalOverflow(page);
      expect(
        overflows,
        `${label} page must not scroll horizontally at 390 px viewport`,
      ).toBe(false);
    },
  );
}

// ── 2. "Add Vendor" opens a bottom Sheet on mobile ────────────────────────────

test(
  "Add Vendor button opens a bottom Sheet (not a Dialog) on mobile",
  async ({ page }) => {
    await gotoAuthenticated(page, "/procurement/vendors");

    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });

    // Use .first() — the header has one "Add Vendor" button and the EmptyState
    // CTA may render a second one when the list is empty.
    const addBtn = page.getByRole("button", { name: /add vendor/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 20_000 });

    await addBtn.click();

    // ResponsiveDialog at < 640 px renders SheetContent side="bottom".
    // sheetVariants({ side: "bottom" }) applies class "bottom-0" (no data-side
    // attribute — shadcn/ui uses CSS classes, not data attributes, for sides).
    // Radix also sets data-state="open" on the content element once open.
    const sheet = page.locator('div[data-state="open"][class*="bottom-0"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // The sheet title must say "New Vendor".
    await expect(
      page.getByRole("heading", { name: "New Vendor" }),
    ).toBeVisible();

    // A centred Dialog (desktop path) has a fixed overlay + flex items-center.
    // Assert it is absent at 390 px so we know the Sheet path was chosen.
    const centredModal = page.locator(
      'div[role="dialog"][class*="fixed"][class*="items-center"]',
    );
    await expect(centredModal).toHaveCount(0);
  },
);

// ── 3. CRM kanban — horizontal scroll + CSS snap ──────────────────────────────

test(
  "CRM kanban scrolls horizontally and columns have snap alignment",
  async ({ page }) => {
    // We need a token to make pre-seed API calls.  Navigate to root first so
    // storageState is loaded, then read the token that globalSetup placed there.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const token = await page.evaluate(
      () => localStorage.getItem("mystics_token") ?? "",
    );

    if (!token) {
      throw new Error("CRM test: no auth token found in localStorage — globalSetup may have failed");
    }

    // Check how many leads exist; create one if the DB is empty.
    const leadsResp = await page.request.get("http://localhost:8080/api/leads", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const leads = (await leadsResp.json()) as unknown[];
    if (!Array.isArray(leads) || leads.length === 0) {
      await page.request.post("http://localhost:8080/api/leads", {
        data: {
          companyName: "E2E Seed Corp",
          contactName: "Test User",
          contactPhone: "+91 90000 00001",
          contactEmail: "e2e.seed@example.com",
          productInterest: "Solar EPC",
          estimatedValue: 500000,
          status: "New",
          source: "Inbound",
          notes: "Seeded by E2E mobile responsive test",
        },
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    }

    await page.goto("/crm", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });

    // PipelineSection renders a flex row with inline style
    // `scroll-snap-type: x mandatory` when there are leads.
    const snapLocator = page.locator('[style*="scroll-snap-type"]').first();
    await expect(snapLocator).toBeVisible({ timeout: 20_000 });

    // 1. The container must be horizontally scrollable (children are wider
    //    than 390 px because each stage column has a fixed minimum width).
    const isScrollable = await snapLocator.evaluate(
      (el: HTMLElement) => el.scrollWidth > el.clientWidth,
    );
    expect(
      isScrollable,
      "Kanban container should be wider than the viewport",
    ).toBe(true);

    // 2. Every direct-child column must have scrollSnapAlign = "start".
    const snapAlignValues = await snapLocator.evaluate((el: HTMLElement) => {
      return Array.from(el.children).map(
        (c) =>
          (c as HTMLElement).style.scrollSnapAlign ||
          getComputedStyle(c as HTMLElement).scrollSnapAlign,
      );
    });

    expect(
      snapAlignValues.length,
      "Kanban should have at least one stage column",
    ).toBeGreaterThan(0);

    for (const value of snapAlignValues) {
      expect(
        value,
        `Each kanban column should snap to "start", got "${value}"`,
      ).toBe("start");
    }

    // 3. Programmatic scroll confirms the container actually moves.
    const scrollBefore = await snapLocator.evaluate(
      (el: HTMLElement) => el.scrollLeft,
    );
    await snapLocator.evaluate((el: HTMLElement) => {
      const firstChild = el.firstElementChild as HTMLElement | null;
      el.scrollLeft += firstChild?.offsetWidth ?? 300;
    });
    const scrollAfter = await snapLocator.evaluate(
      (el: HTMLElement) => el.scrollLeft,
    );
    expect(scrollAfter, "Kanban must scroll rightward").toBeGreaterThan(
      scrollBefore,
    );
  },
);
