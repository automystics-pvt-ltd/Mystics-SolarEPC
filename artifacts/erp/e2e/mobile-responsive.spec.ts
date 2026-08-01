/**
 * Mobile responsive smoke tests — 390 × 844 px (iPhone 14)
 *
 * These tests verify the four responsive changes shipped in Task #225:
 *  1. DataTable hides overflow columns on narrow screens — the outer page must
 *     not grow wider than the 390 px viewport.
 *  2. "Add Vendor" opens a bottom Sheet, not a centered Dialog.
 *  3. CRM kanban scrolls horizontally with CSS snap alignment per column.
 */

import { test, expect, type Page } from "@playwright/test";

// ── Auth helper ────────────────────────────────────────────────────────────────

/**
 * POST to the API server (port 8080 — page.request bypasses the Vite proxy)
 * and inject the JWT plus a minimal user-cache entry so React skips the
 * /api/auth/me round-trip and renders protected routes immediately.
 *
 * Must be called AFTER page.goto() so the localStorage context exists.
 */
async function loginAs(page: Page, email: string, password: string) {
  const resp = await page.request.post("http://localhost:8080/api/auth/login", {
    data: { email, password },
    headers: { "Content-Type": "application/json" },
  });

  if (!resp.ok()) {
    throw new Error(`Login failed ${resp.status()}: ${await resp.text()}`);
  }

  const { token, user } = (await resp.json()) as {
    token: string;
    user: Record<string, unknown>;
  };

  // Store token AND user cache so the React app doesn't re-fetch /api/auth/me.
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem("mystics_token", token);
      localStorage.setItem(
        "mystics_user_v2",
        JSON.stringify({ user, ts: Date.now() }),
      );
    },
    { token, user },
  );
}

// ── Shared setup ───────────────────────────────────────────────────────────────

/**
 * Navigate to a protected page already authenticated.
 *
 * After navigating to the target path we wait for networkidle to give React
 * Query time to complete its initial data fetches before assertions run.
 */
async function gotoAuthenticated(page: Page, path: string) {
  // Load root first so the JS bundle is parsed and localStorage is accessible.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await loginAs(page, "admin@automystics.com", "admin123");
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
    // Seed at least one lead via the API so the kanban body renders.
    // (The pipeline section only mounts the scroll container when leads exist.)
    const loginResp = await page.request.post(
      "http://localhost:8080/api/auth/login",
      {
        data: {
          email: "admin@automystics.com",
          password: "admin123",
        },
        headers: { "Content-Type": "application/json" },
      },
    );
    const { token } = (await loginResp.json()) as { token: string };

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

    await gotoAuthenticated(page, "/crm");
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
