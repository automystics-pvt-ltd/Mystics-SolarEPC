/**
 * Verification script: confirms unlinked vendor invoices are correctly
 * counted in the vendor-performance report after the fix.
 *
 * Run with: npx tsx artifacts/api-server/scripts/verify-unlinked-vendor-perf.ts
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

const UNLINKED_VENDOR_NAME = "__test_unlinked_vendor_perf_check__";

async function seed() {
  // Create a PO with vendorId = NULL (unlinked vendor)
  const poRes = await client.query<{ id: number }>(
    `INSERT INTO procurement_pos
       (po_number, vendor_name, vendor_id, status, total_amount)
     VALUES ($1, $2, NULL, 'Issued', 75000)
     RETURNING id`,
    [`TEST-PO-${Date.now()}`, UNLINKED_VENDOR_NAME],
  );
  const poId = poRes.rows[0].id;
  console.log(`  Seeded PO id=${poId}`);

  // Create a GRN under the same unlinked name
  const grnRes = await client.query<{ id: number }>(
    `INSERT INTO proc_grns
       (grn_number, po_id, vendor_name, vendor_id, status)
     VALUES ($1, $2, $3, NULL, 'Accepted')
     RETURNING id`,
    [`TEST-GRN-${Date.now()}`, poId, UNLINKED_VENDOR_NAME],
  );
  const grnId = grnRes.rows[0].id;
  console.log(`  Seeded GRN id=${grnId}`);

  // Add a GRN item so acceptance metrics are visible
  await client.query(
    `INSERT INTO proc_grn_items
       (grn_id, line_no, material_name, ordered_qty, received_qty, accepted_qty, rejected_qty, unit_price, qc_status)
     VALUES ($1, 1, 'Test Material', 10, 10, 10, 0, 7500, 'Accepted')`,
    [grnId],
  );

  // Create an invoice with vendorId = NULL — this is the gap the fix addresses
  const invRes = await client.query<{ id: number }>(
    `INSERT INTO proc_invoices
       (invoice_number, po_id, grn_id, vendor_name, vendor_id, status,
        subtotal, total_amount, net_payable)
     VALUES ($1, $2, $3, $4, NULL, 'Approved', 72000, 72000, 72000)
     RETURNING id`,
    [`TEST-INV-${Date.now()}`, poId, grnId, UNLINKED_VENDOR_NAME],
  );
  const invId = invRes.rows[0].id;
  console.log(`  Seeded Invoice id=${invId} netPayable=72000`);

  return { poId, grnId, invId };
}

async function cleanup(ids: { poId: number; grnId: number; invId: number }) {
  await client.query("DELETE FROM proc_invoices WHERE id = $1", [ids.invId]);
  await client.query("DELETE FROM proc_grn_items WHERE grn_id = $1", [ids.grnId]);
  await client.query("DELETE FROM proc_grns WHERE id = $1", [ids.grnId]);
  await client.query("DELETE FROM procurement_pos WHERE id = $1", [ids.poId]);
  console.log("  Cleaned up test rows.");
}

async function main() {
  await client.connect();

  console.log("\n=== Seeding test data ===");
  const ids = await seed();

  console.log("\n=== Fetching vendor-performance report ===");
  const apiBase = process.env.API_BASE_URL || "http://localhost:3001";
  const resp = await fetch(`${apiBase}/api/reports/vendor-performance`);
  if (!resp.ok) {
    console.error(`API returned ${resp.status}: ${await resp.text()}`);
    await cleanup(ids);
    await client.end();
    process.exit(1);
  }
  const data = (await resp.json()) as { vendors: Array<{
    name: string;
    linked: boolean;
    totalPOs: number;
    totalGRNs: number;
    totalInvoices: number;
    totalSpend: number;
    totalInvoiceSpend: number;
  }> };

  const entry = data.vendors.find(v => v.name === UNLINKED_VENDOR_NAME);

  console.log("\n=== Assertions ===");
  const failures: string[] = [];

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ ${msg}`);
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failures.push(msg);
    }
  }

  if (!entry) {
    console.error(`  ✗ FAIL: Unlinked vendor '${UNLINKED_VENDOR_NAME}' not found in response`);
    failures.push("Vendor not found in response");
  } else {
    console.log("  Raw entry:", JSON.stringify(entry, null, 2));
    assert(entry.linked === false, "linked=false for unlinked vendor");
    assert(entry.totalPOs === 1, `totalPOs=1 (got ${entry.totalPOs})`);
    assert(entry.totalGRNs === 1, `totalGRNs=1 (got ${entry.totalGRNs})`);
    assert(entry.totalInvoices === 1,
      `totalInvoices=1 — was hard-coded 0 before fix (got ${entry.totalInvoices})`);
    assert(
      Math.abs(entry.totalInvoiceSpend - 72000) < 0.01,
      `totalInvoiceSpend=72000 — was missing before fix (got ${entry.totalInvoiceSpend})`
    );
    assert(
      Math.abs(entry.totalSpend - 75000) < 0.01,
      `totalSpend=75000 from PO (got ${entry.totalSpend})`
    );
  }

  console.log("\n=== Cleanup ===");
  await cleanup(ids);
  await client.end();

  if (failures.length > 0) {
    console.error(`\n${failures.length} assertion(s) failed.`);
    process.exit(1);
  } else {
    console.log("\nAll assertions passed — unlinked vendor invoices are correctly counted.");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
