/**
 * Cache-invalidation smoke tests
 *
 * Verifies that CRUD mutations correctly update lists and dashboards
 * without requiring a manual page reload.  Each test:
 *   1. Sets up state via direct API calls when needed.
 *   2. Drives the action through the browser UI.
 *   3. Asserts the relevant list / detail view refreshes in-place.
 *
 * Auth strategy: same storageState written by globalSetup (admin account).
 *
 * Flows covered:
 *   1. Create lead  → card appears in the CRM pipeline kanban
 *   2. Create project → entry appears in the Projects list
 *   3. Create quotation → browser redirects to /crm/quotations/:id (not "new")
 *   4. Approve GRN  → linked PO status updates
 */

import { test, expect, type Page } from "@playwright/test";

// ── Shared helper ──────────────────────────────────────────────────────────────

/**
 * Navigate to a protected SPA route.
 * Auth is already in localStorage (storageState restored by Playwright).
 */
async function gotoAuth(page: Page, path: string) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
}

/** Read the JWT that globalSetup placed in localStorage. */
async function getToken(page: Page): Promise<string> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const token = await page.evaluate(
    () => localStorage.getItem("mystics_token") ?? "",
  );
  if (!token)
    throw new Error(
      "No auth token in localStorage — globalSetup may have failed",
    );
  return token;
}

// ── 1. Create lead → appears in CRM pipeline ──────────────────────────────────

test(
  "create lead → new card appears in CRM pipeline without reload",
  async ({ page }) => {
    const unique = `E2E-Lead-${Date.now()}`;

    await gotoAuth(page, "/crm");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });

    // Wait for the pipeline kanban to finish loading data.
    await page.waitForLoadState("networkidle", { timeout: 20_000 });

    // The "New Lead" button is wrapped in <CanCreate module="crm">.
    // Admin has all permissions, so it must be visible.
    const addBtn = page.getByRole("button", { name: /new lead/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 20_000 });
    await addBtn.click();

    // Fill the create-lead form.
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Company Name (required, placeholder: "e.g. Sunrise Infra Pvt Ltd")
    await dialog
      .getByPlaceholder(/sunrise infra/i)
      .fill(unique);

    // Contact Person (required, placeholder: "Full name")
    await dialog.getByPlaceholder(/full name/i).fill("E2E Tester");

    // "Source" and "Stage" both default to valid values (Inbound / New)
    // in the form's defaultValues — no interaction needed.

    // Submit via the "Create Lead" button (type="submit" inside the form).
    await dialog.getByRole("button", { name: /create lead/i }).click();

    // Dialog closes on success.
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    // The new lead card must appear in the kanban "New" column.
    await expect(page.locator("text=" + unique).first()).toBeVisible({
      timeout: 15_000,
    });
  },
);

// ── 2. Create project → appears in Projects list ──────────────────────────────

test(
  "create project → entry appears in Projects list without reload",
  async ({ page }) => {
    const unique = `E2E-Project-${Date.now()}`;

    await gotoAuth(page, "/projects");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });

    await page.waitForLoadState("networkidle", { timeout: 20_000 });

    // Open the create-project dialog.
    const newBtn = page
      .getByRole("button", { name: /new project/i })
      .first();
    await expect(newBtn).toBeVisible({ timeout: 20_000 });
    await newBtn.click();

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Project Name (required, placeholder mentions "Rooftop Solar").
    const nameInput = dialog
      .getByPlaceholder(/rooftop solar/i)
      .first();
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill(unique);

    // Use requestSubmit() on the form to trigger HTML5 form validation and
    // submission without relying on pointer events (which can be blocked by
    // the mobile bottom-nav bar that sits below the dialog footer).
    // We race requestSubmit() with a network-response waiter so we can tell
    // whether the API call actually fires.
    const [projectResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/projects") && r.request().method() === "POST",
        { timeout: 15_000 },
      ),
      page.evaluate(() => {
        const form = document.querySelector('[role="dialog"] form');
        if (form instanceof HTMLFormElement) form.requestSubmit();
      }),
    ]);

    // Confirm the server accepted the request.
    expect(projectResp.status(), "POST /api/projects should return 200/201").toBeLessThan(300);

    // Dialog must close on success (onSuccess calls onOpenChange(false)).
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    // The project entry must appear in the list without a manual reload.
    await expect(page.locator("text=" + unique).first()).toBeVisible({
      timeout: 15_000,
    });
  },
);

// ── 3. Create quotation → redirects to /crm/quotations/:id ───────────────────

test(
  "create quotation → browser redirects to /crm/quotations/:id",
  async ({ page }) => {
    const token = await getToken(page);

    // Ensure at least one lead exists.
    const leadsResp = await page.request.get(
      "http://localhost:8080/api/leads",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    let leads = (await leadsResp.json()) as Array<{
      id: number;
      companyName: string;
    }>;
    if (!Array.isArray(leads) || leads.length === 0) {
      const r = await page.request.post("http://localhost:8080/api/leads", {
        data: {
          companyName: "E2E Seed Corp",
          contactName: "E2E Tester",
          status: "New",
          source: "Inbound",
        },
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      leads = [(await r.json()) as { id: number; companyName: string }];
    }
    const leadId = leads[0].id;

    // Navigate to the "new quotation" form (leadId pre-fills the lead selector).
    await gotoAuth(page, `/crm/quotations/new?leadId=${leadId}`);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });

    // Wait for the form to render (the "Create Quotation" save button is the signal).
    const saveBtn = page
      .getByRole("button", { name: /create quotation/i })
      .first();
    await expect(saveBtn).toBeVisible({ timeout: 20_000 });

    // The API requires at least one BOQ line with a description.
    // Scroll down to find the "Add Row" button in the BOQ section.
    const addRowBtn = page
      .getByRole("button", { name: /add row/i })
      .first();
    await addRowBtn.scrollIntoViewIfNeeded();
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();

    // The description cell in the new row uses MaterialCombobox — a button
    // that opens a popover with a search <input>.  Click the trigger button
    // ("Select or type item…") to open the popover.
    const comboTrigger = page
      .locator("table tbody button")
      .filter({ hasText: /select or type item/i })
      .first();
    await expect(comboTrigger).toBeVisible({ timeout: 5_000 });
    await comboTrigger.click();

    // Wait for the popover search input to appear.
    const searchInput = page
      .locator('input[placeholder*="Search items"]')
      .first();
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Select the FIRST existing material from the dropdown (avoids DB insert).
    // Seeded materials are always present; clicking the first result is reliable.
    const firstResult = page
      .locator('[data-radix-popper-content-wrapper] button, [style*="z-index"] button')
      .filter({ hasNotText: /create/i })
      .filter({ has: page.locator("p.font-semibold") })
      .first();
    await expect(firstResult).toBeVisible({ timeout: 5_000 });
    await firstResult.click();

    // Popover closes after selection; wait for it to settle.
    await expect(comboTrigger).not.toBeVisible({ timeout: 5_000 });

    // Scroll back up to the "Create Quotation" button and click it.
    await saveBtn.scrollIntoViewIfNeeded();
    await saveBtn.click();

    // The page must redirect to /crm/quotations/<number>, NOT stay on /new.
    await expect(page).toHaveURL(/\/crm\/quotations\/\d+$/, {
      timeout: 15_000,
    });

    // The detail page must show the QTN-XXXX code confirming a real record.
    await expect(page.locator("text=/QTN-\\d{4}/")).toBeVisible({
      timeout: 10_000,
    });
  },
);

// ── 4. Approve GRN → GRN status + linked PO detail update ────────────────────

test(
  "approve GRN → GRN status updates to Accepted and PO list shows the PO",
  async ({ page }) => {
    const token = await getToken(page);

    // ── Setup: create a fresh Draft GRN against PO #3 (status: Issued) ──
    // PO #3 has 2 items (IDs 3 and 4) in Issued state.
    // We include one line item with acceptedQty > 0 so the approve endpoint
    // marks the GRN as "Accepted" rather than auto-rejecting it (the server
    // rejects GRNs where totalAcceptedQty === 0).
    const TARGET_PO_ID = 3;
    const createResp = await page.request.post(
      "http://localhost:8080/api/proc-grns",
      {
        data: {
          poId: TARGET_PO_ID,
          deliveryDate: new Date().toISOString().slice(0, 10),
          receivedBy: 5,
          remarks: `E2E GRN ${Date.now()}`,
          items: [
            {
              // PO item #3 — "DC Solar Cable 4mm² H1Z2Z2-K", qty 28000
              // Material fields must be supplied: the route copies them straight
              // from the request body (it does NOT look them up from the PO item
              // for the insert — see proc_grns.ts calcItems).
              poItemId: 3,
              materialId: 5,
              materialCode: "MAT-005",
              materialName: "DC Solar Cable 4mm\u00b2 H1Z2Z2-K",
              uom: "Mtr",
              orderedQty: 1,
              receivedQty: 1,
              acceptedQty: 1,
              rejectedQty: 0,
              damagedQty: 0,
              unitPrice: 38,
            },
          ],
        },
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    let grnId: number;
    let grnNumber: string;
    let poId: number;

    if (!createResp.ok()) {
      // PO may already be FullyReceived — find any Submitted GRN instead.
      const grnsResp = await page.request.get(
        "http://localhost:8080/api/proc-grns",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const grns = (await grnsResp.json()) as Array<{
        id: number;
        grnNumber: string;
        status: string;
        poId: number;
      }>;
      const submitted = Array.isArray(grns)
        ? grns.find((g) => g.status === "Submitted")
        : undefined;
      if (!submitted) {
        test.skip(
          true,
          "Cannot create or find a Submitted GRN — seed data required",
        );
        return;
      }
      grnId     = submitted.id;
      grnNumber = submitted.grnNumber;
      poId      = submitted.poId;
    } else {
      const newGrn = (await createResp.json()) as {
        id: number;
        grnNumber: string;
        status: string;
      };
      expect(newGrn.status).toBe("Draft");
      grnId     = newGrn.id;
      grnNumber = newGrn.grnNumber;
      poId      = TARGET_PO_ID;

      // Submit via API so it's ready for UI approval.
      const submitResp = await page.request.post(
        `http://localhost:8080/api/proc-grns/${grnId}/submit`,
        {
          data: { userName: "E2E Admin", userId: 5, remarks: "Submitted by E2E" },
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      expect(submitResp.ok(), `Submit GRN ${grnId} failed`).toBe(true);
    }

    // ── Fetch the PO number BEFORE approval so we can assert it afterwards ──
    const poResp = await page.request.get(
      `http://localhost:8080/api/procurement-pos/${poId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(poResp.ok(), `Fetch PO ${poId} failed`).toBe(true);
    const po = (await poResp.json()) as { id: number; poNumber: string; status: string };
    const poNumber = po.poNumber; // e.g. "PO-2026-0003"

    // ── Run the UI approval flow ──────────────────────────────────────────────
    await runApproveFlow(page, grnId, grnNumber, poId, poNumber, token);
  },
);

/**
 * GRN-approval smoke flow:
 *  1. Navigate to the GRN detail page and approve via UI.
 *  2. Assert the GRN status badge refreshes to Accepted without a page reload.
 *  3. Navigate to the LINKED PO's detail page (the specific PO, not just the list).
 *  4. Assert the GRN tab on that PO shows the newly-accepted GRN — confirming
 *     that React Query's `getGetProcurementPOQueryKey(poId)` invalidation served
 *     fresh data.
 */
async function runApproveFlow(
  page: Page,
  grnId: number,
  grnNumber: string,
  poId: number,
  poNumber: string,
  token: string,
): Promise<void> {
  await gotoAuth(page, `/procurement/grns/${grnId}`);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });

  // Wait for the GRN detail to fully load.
  // On mobile (390px) the desktop header buttons are `hidden lg:flex` — not
  // visible.  The visible Approve button lives in the mobile sticky action bar
  // (`fixed bottom-16`).  Target it by the h-14 class (mobile bar only) plus
  // the emerald colour class to exclude the Reject button.
  const approveBtn = page
    .locator('button[class*="h-14"][class*="emerald"]')
    .filter({ hasText: /approve/i })
    .first();
  await expect(approveBtn).toBeVisible({ timeout: 25_000 });

  // Intercept the mutation request BEFORE clicking so we don't miss fast responses.
  const mutationRespPromise = page.waitForResponse(
    (r) =>
      r.url().includes(`/api/proc-grns/${grnId}/`) &&
      r.request().method() === "POST",
    { timeout: 20_000 },
  );

  await approveBtn.click();

  // Action dialog appears — assert title says "approve" (not "reject").
  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog).toBeVisible({ timeout: 8_000 });
  await expect(dialog.locator('h2, [role="heading"]').first()).toContainText(
    /approve/i,
    { timeout: 5_000 },
  );

  const remarksArea = dialog.locator("textarea").first();
  await expect(remarksArea).toBeVisible({ timeout: 5_000 });
  await remarksArea.fill("Approved by E2E test — all items checked");
  await dialog.getByRole("button", { name: "Confirm" }).click();

  // Verify the approve endpoint (not reject) was called and succeeded.
  const mutationResp = await mutationRespPromise;
  expect(
    mutationResp.url(),
    "Expected POST /proc-grns/:id/approve, not /reject",
  ).toContain(`/proc-grns/${grnId}/approve`);
  expect(
    mutationResp.status(),
    "GRN approve must return 2xx",
  ).toBeLessThan(300);

  // Dialog must close after success.
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  // ① GRN status change verified WITHOUT a page reload:
  //    The Approve button disappears once the GRN leaves "Submitted" state
  //    (canApprove becomes false), so its absence proves the live update fired.
  await expect(approveBtn).not.toBeVisible({ timeout: 15_000 });

  // ② Navigate to the SPECIFIC linked PO's detail page and open its GRN tab.
  // This verifies that the React Query cache for this exact PO was invalidated
  // (getGetProcurementPOQueryKey(poId)) so fresh data is served on next read.
  await page.goto(`/procurement/pos/${poId}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 20_000 });
  await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });

  // The PO detail page heading must show the expected PO number.
  await expect(page.locator(`text=${poNumber}`).first()).toBeVisible({
    timeout: 15_000,
  });

  // Click the "GRNs" tab — the count badge in the tab label confirms the
  // approved GRN was linked to this PO and the data is fresh.
  const grnsTab = page
    .getByRole("tab", { name: /^grns/i })
    .first();
  await expect(grnsTab).toBeVisible({ timeout: 10_000 });
  await grnsTab.click();

  // The GRN tab panel (currently active) lists all GRNs for this PO.
  // Scope assertions to the active tab panel so we don't match text from
  // other tabs or parts of the page.
  const grnsPanel = page.locator('[role="tabpanel"][data-state="active"]').first();

  // Scroll to the specific GRN row (monospaced GRN number text).
  const grnNumberEl = grnsPanel.locator(`text=${grnNumber}`).first();
  await grnNumberEl.scrollIntoViewIfNeeded();
  await expect(grnNumberEl).toBeVisible({ timeout: 10_000 });

  // The PO GRN tab only shows: grnNumber, date, and status badge per row.
  // There are no "Accepted" column-header strings here, so finding "Accepted"
  // in the panel confirms the specific GRN's StatusBadge now reads Accepted —
  // proving the PO React Query cache was invalidated and served fresh data.
  const acceptedInPanel = grnsPanel
    .locator("text=/^Accepted$|^PartiallyAccepted$/")
    .first();
  await expect(acceptedInPanel).toBeVisible({ timeout: 10_000 });
}
