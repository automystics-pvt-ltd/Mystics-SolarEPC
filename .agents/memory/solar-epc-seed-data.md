---
name: Solar EPC real seed data
description: Column name quirks found when writing the comprehensive realistic seed for Solar EPC; run command and login creds
---

## Key column name differences vs. what you'd guess

| Table | Gotcha |
|-------|--------|
| `stock_ledger` | No `notes` or `created_by` column — columns are `item_name` (required), `ref_doc_type`, `ref_doc_id`, `date` (date, not timestamptz) |
| `material_stock_levels` | Uses `current_qty` / `allocated_qty` / `available_qty` (not `quantity` / `reserved_quantity`) — also needs `material_name` (required) |
| `material_suppliers` | `vendor_name` is **required** (NOT NULL) even though it's denormalized |
| `proc_invoice_items` | Column is `gst_amount` not `total_gst`; also needs `invoiced_qty` + `ordered_qty` + `received_qty` separately |
| `procurement_quotations` | Vendor name stored as `vendor_snapshot_name` (not `vendor_name`) |
| `proc_grn_items` | `line_no` is required — auto sequence not assumed |

## What's seeded
- 4 users, 5 leads, 2 CRM quotations, 3 projects, 5 contractors, 3 warehouses
- 5 vendors with contacts, 12 materials across 5 categories, material-supplier links
- 3 procurement quotations → 3 POs → 2 GRNs → 2 invoices (complete P2P chain)
- Stock ledger (inward + outward) and material_stock_levels for 2 site stores

## Run command
```
pnpm --filter @workspace/api-server exec tsx src/seed.ts
```

**Why:** Use `pg.Client` (not Drizzle) for all procurement/inventory inserts — Drizzle pool leaks on FK errors (see drizzle-pool-pitfall.md).

## Login credentials (seeded)
- admin@automystics.com / admin123
- meera@automystics.com / sales123
- vikram@automystics.com / pm123
- santosh@automystics.com / wh123
