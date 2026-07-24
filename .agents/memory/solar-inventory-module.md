---
name: Solar Inventory & Warehouse Management Module
description: Comprehensive solar inventory module — schema, API, and frontend pages built in a full implementation session.
---

## What was built

### DB Schema (applied via raw SQL — NOT via drizzle push, which requires TTY)
- Enhanced `warehouses` table: +warehouse_code, contact_person, phone, email, address, gst_number, is_active, manager_name, description, updated_at
- New `solar_item_categories`: 12 seeded categories (PANEL, INVERTER, BATTERY, MOUNT, CABLE, BOS, METER, SPARE, TOOL, CONSUMABLE, CIVIL, ELECTRICAL)
- New `material_stock_levels`: per-material per-warehouse stock with min/max/reorder levels, is_below_reorder, is_out_of_stock flags
- New `project_material_allocations`: Draft→Approved→Issued/PartiallyIssued lifecycle with stock reservation
- New `material_returns`: Draft→InTransit→Received→Closed lifecycle with stock write-through on receive
- New `inventory_audit_items`: per-line item audit detail linked to inventory_audits
- New `reorder_alerts`: auto-generated when stock below min

### API Route: `artifacts/api-server/src/routes/solar_inventory.ts`
Registered in `routes/index.ts` as `solarInventoryRouter`.

Endpoints:
- `GET /inventory/dashboard` — KPI stats, category breakdown, reorder alerts, recent movements, movement trend
- `GET /inventory/categories` — solar item categories list
- `GET /inventory/stock-levels` — filterable by warehouseId, categoryCode, belowReorder, outOfStock, search
- `POST /inventory/stock-levels` — upsert stock level (ON CONFLICT on material_name+warehouse_id)
- `PATCH /inventory/stock-levels/:id` — update min/max/reorder/cost levels
- `GET /inventory/reorder-analysis` — items below reorder + open alerts
- `POST /inventory/reorder-alerts/:id/acknowledge` — mark alert acknowledged
- `GET|POST /inventory/allocations` — CRUD
- `POST /inventory/allocations/:id/approve` — checks stock availability, reserves allocated_qty
- `POST /inventory/allocations/:id/issue` — deducts from current_qty, writes stock_ledger entry
- `POST /inventory/allocations/:id/cancel` — releases reserved stock
- `GET|POST /inventory/returns` — CRUD
- `POST /inventory/returns/:id/receive` — upserts stock levels, writes stock_ledger, marks received
- `POST /inventory/returns/:id/close`
- `GET|POST /inventory/audits/:auditId/items` — per-item audit entries
- `PATCH /inventory/audits/:auditId/items/:itemId` — record physical count
- `GET /inventory/warehouses-enhanced` — warehouses with SKU count, total value, below reorder count
- `PATCH /inventory/warehouses-enhanced/:id` — update enhanced warehouse details
- `GET /inventory/stock-aging` — items with aging buckets (0-30, 31-60, 61-90, 91-180, 180+)

### Frontend Pages
All in `artifacts/erp/src/pages/inventory/`:
- `InventoryDashboard.tsx` — KPI cards, category pie chart, reorder alerts, recent movements, quick actions
- `StockSummaryPage.tsx` — cross-warehouse stock levels with category/warehouse/status filters, add/edit stock levels
- `ProjectAllocations.tsx` — allocations list with create/approve/issue workflow in dialogs
- `MaterialReturns.tsx` — returns list with multi-item return creation, receive action
- `ReorderPlanning.tsx` — shortage items + open alerts in tabs, acknowledge alerts, export
- `WarehouseDetail.tsx` — enhanced: Stock Summary / Material Levels / Bin Locations / Info tabs + edit dialog

### Navigation & Routes
NavRail inventory group now has 11 items:
Dashboard, Stock Summary, Warehouses, Allocations, Material Returns, Reorder Planning,
Stock Transfers, Delivery Challans, Stock Ledger, Stock Valuation, Audits

App.tsx routes added:
/inventory/dashboard, /inventory/stock-levels, /inventory/allocations, /inventory/returns, /inventory/reorder-planning

## Key patterns
- All new DB queries use raw pg.Client (not Drizzle) due to tables not in the Drizzle schema
- Stock write-through: issue allocation → deduct material_stock_levels + insert stock_ledger; receive return → upsert material_stock_levels + insert stock_ledger
- Drizzle push requires TTY; use raw psql for migrations: `psql "$DATABASE_URL" -f /tmp/migrate.sql`
- Invoice schema changes also applied in same migration session (new enum values, 30+ new columns, invoice_comments, invoice_payments tables)

**Why:** The existing inventory was basic read-only scaffolding. This builds the full lifecycle for solar EPC: procurement → warehouse → project allocation → site → return.
