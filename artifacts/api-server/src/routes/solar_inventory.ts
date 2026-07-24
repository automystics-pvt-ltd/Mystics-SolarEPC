import { Router, type IRouter } from "express";
import { requireAuth, requirePermission } from "../lib/rbac";
import { db, warehousesTable, stockLedgerTable, inventoryAuditsTable } from "@workspace/db";
import { eq, desc, and, sql, lt, lte, gte, like, or, inArray } from "drizzle-orm";
import pg from "pg";

const { Client } = pg;

const router: IRouter = Router();
router.use(requireAuth());

// ── DB helpers ──────────────────────────────────────────────────────────────
async function getClient() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return client;
}

async function query(text: string, params: any[] = []) {
  const client = await getClient();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    await client.end();
  }
}

function nextAllocationNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(2);
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `PMA-${y}${m}-${rand}`;
}

function nextReturnNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(2);
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `MRN-${y}${m}-${rand}`;
}

// ── INVENTORY DASHBOARD ──────────────────────────────────────────────────────
router.get("/inventory/dashboard", async (req, res): Promise<void> => {
  try {
    const [
      warehouseCount, stockValueRes, belowReorderRes, outOfStockRes,
      pendingTransfers, pendingAllocations, pendingReturns,
      recentLedger, categoryBreakdown, reorderAlerts, monthlyMovements
    ] = await Promise.all([
      query(`SELECT COUNT(*) FROM warehouses WHERE is_active = true`),
      query(`SELECT COALESCE(SUM(total_value),0) as total_value, COUNT(DISTINCT material_name) as sku_count FROM material_stock_levels`),
      query(`SELECT COUNT(*) FROM material_stock_levels WHERE is_below_reorder = true AND current_qty > 0`),
      query(`SELECT COUNT(*) FROM material_stock_levels WHERE is_out_of_stock = true`),
      query(`SELECT COUNT(*) FROM stock_transfers WHERE status IN ('Draft','Approved','InTransit')`),
      query(`SELECT COUNT(*) FROM project_material_allocations WHERE status IN ('Draft','Approved')`),
      query(`SELECT COUNT(*) FROM material_returns WHERE status IN ('Draft','InTransit')`),
      query(`SELECT sl.*, w.name as warehouse_name FROM stock_ledger sl LEFT JOIN warehouses w ON w.id = sl.warehouse_id ORDER BY sl.id DESC LIMIT 10`),
      query(`SELECT category_code, category_name, COUNT(*) as sku_count, SUM(current_qty) as total_qty, SUM(total_value) as total_value FROM material_stock_levels WHERE category_code IS NOT NULL GROUP BY category_code, category_name ORDER BY total_value DESC LIMIT 12`),
      query(`SELECT ra.*, msl.material_name, msl.uom FROM reorder_alerts ra LEFT JOIN material_stock_levels msl ON msl.id = ra.material_stock_level_id WHERE ra.status = 'Open' ORDER BY ra.shortage_qty DESC LIMIT 10`),
      query(`SELECT DATE_TRUNC('day', CURRENT_DATE - generate_series * INTERVAL '1 day') as day, 0 as inward, 0 as outward FROM generate_series(0,29) ORDER BY day`)
    ]);

    // Monthly inward/outward from stock_ledger (last 30 days)
    const movementRes = await query(`
      SELECT 
        DATE_TRUNC('day', created_at)::date as day,
        SUM(CASE WHEN txn_type = 'Inward' THEN qty ELSE 0 END) as inward,
        SUM(CASE WHEN txn_type = 'Outward' THEN qty ELSE 0 END) as outward
      FROM stock_ledger
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY day
    `);

    res.json({
      stats: {
        totalWarehouses: Number(warehouseCount.rows[0].count),
        totalStockValue: Number(stockValueRes.rows[0].total_value),
        totalSKUs: Number(stockValueRes.rows[0].sku_count),
        belowReorderCount: Number(belowReorderRes.rows[0].count),
        outOfStockCount: Number(outOfStockRes.rows[0].count),
        pendingTransfers: Number(pendingTransfers.rows[0].count),
        pendingAllocations: Number(pendingAllocations.rows[0].count),
        pendingReturns: Number(pendingReturns.rows[0].count),
      },
      categoryBreakdown: categoryBreakdown.rows.map(r => ({
        categoryCode: r.category_code,
        categoryName: r.category_name,
        skuCount: Number(r.sku_count),
        totalQty: Number(r.total_qty),
        totalValue: Number(r.total_value),
      })),
      reorderAlerts: reorderAlerts.rows.map(r => ({
        id: r.id,
        materialName: r.material_name,
        warehouseId: r.warehouse_id,
        warehouseName: r.warehouse_name,
        currentQty: Number(r.current_qty || 0),
        minStockLevel: Number(r.min_stock_level || 0),
        shortageQty: Number(r.shortage_qty || 0),
        suggestedOrderQty: Number(r.suggested_order_qty || 0),
        uom: r.uom,
      })),
      recentMovements: recentLedger.rows.map(r => ({
        id: r.id,
        itemName: r.item_name,
        txnType: r.txn_type,
        qty: Number(r.qty),
        warehouseName: r.warehouse_name,
        refDocType: r.ref_doc_type,
        refDocId: r.ref_doc_id,
        date: r.date,
      })),
      movementTrend: movementRes.rows.map(r => ({
        day: r.day,
        inward: Number(r.inward),
        outward: Number(r.outward),
      })),
    });
  } catch (e: any) {
    console.error("inventory/dashboard error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── SOLAR ITEM CATEGORIES ─────────────────────────────────────────────────────
router.get("/inventory/categories", async (_req, res): Promise<void> => {
  try {
    const result = await query(`SELECT * FROM solar_item_categories WHERE is_active = true ORDER BY sort_order, name`);
    res.json(result.rows.map(r => ({
      id: r.id, code: r.code, name: r.name, description: r.description,
      icon: r.icon, isActive: r.is_active, sortOrder: r.sort_order,
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── MATERIAL STOCK LEVELS ─────────────────────────────────────────────────────
router.get("/inventory/stock-levels", async (req, res): Promise<void> => {
  try {
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let pi = 1;
    if (req.query.warehouseId) { whereClause += ` AND msl.warehouse_id = $${pi++}`; params.push(Number(req.query.warehouseId)); }
    if (req.query.categoryCode) { whereClause += ` AND msl.category_code = $${pi++}`; params.push(req.query.categoryCode); }
    if (req.query.belowReorder === "true") { whereClause += ` AND msl.is_below_reorder = true`; }
    if (req.query.outOfStock === "true") { whereClause += ` AND msl.is_out_of_stock = true`; }
    if (req.query.search) { whereClause += ` AND msl.material_name ILIKE $${pi++}`; params.push(`%${req.query.search}%`); }

    const result = await query(`
      SELECT msl.*, w.name as warehouse_name
      FROM material_stock_levels msl
      LEFT JOIN warehouses w ON w.id = msl.warehouse_id
      ${whereClause}
      ORDER BY msl.material_name, msl.warehouse_id
    `, params);

    res.json(result.rows.map(r => ({
      id: r.id,
      materialId: r.material_id,
      materialCode: r.material_code,
      materialName: r.material_name,
      categoryCode: r.category_code,
      categoryName: r.category_name,
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouse_name,
      uom: r.uom,
      currentQty: Number(r.current_qty),
      allocatedQty: Number(r.allocated_qty || 0),
      availableQty: Number(r.available_qty || 0),
      minStockLevel: Number(r.min_stock_level || 0),
      maxStockLevel: Number(r.max_stock_level || 0),
      reorderQty: Number(r.reorder_qty || 0),
      unitCost: Number(r.unit_cost || 0),
      totalValue: Number(r.total_value || 0),
      lastReceivedDate: r.last_received_date,
      lastIssuedDate: r.last_issued_date,
      locationBin: r.location_bin,
      isBelowReorder: r.is_below_reorder,
      isOutOfStock: r.is_out_of_stock,
      updatedAt: r.updated_at,
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/inventory/stock-levels", requirePermission("inventory", "create"), async (req, res): Promise<void> => {
  try {
    const { warehouseId, materialName, materialCode, categoryCode, categoryName, uom, currentQty, unitCost, minStockLevel, maxStockLevel, reorderQty, locationBin } = req.body;
    if (!warehouseId || !materialName) { res.status(400).json({ error: "warehouseId and materialName required" }); return; }

    const totalValue = Number(currentQty || 0) * Number(unitCost || 0);
    const isBelow = Number(currentQty || 0) < Number(minStockLevel || 0);
    const isOut = Number(currentQty || 0) <= 0;

    const result = await query(`
      INSERT INTO material_stock_levels
        (material_code, material_name, category_code, category_name, warehouse_id, uom, current_qty, unit_cost, total_value, min_stock_level, max_stock_level, reorder_qty, location_bin, is_below_reorder, is_out_of_stock, available_qty)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$7)
      ON CONFLICT (material_name, warehouse_id) DO UPDATE SET
        current_qty = EXCLUDED.current_qty,
        unit_cost = EXCLUDED.unit_cost,
        total_value = EXCLUDED.total_value,
        min_stock_level = EXCLUDED.min_stock_level,
        max_stock_level = EXCLUDED.max_stock_level,
        reorder_qty = EXCLUDED.reorder_qty,
        location_bin = EXCLUDED.location_bin,
        is_below_reorder = EXCLUDED.is_below_reorder,
        is_out_of_stock = EXCLUDED.is_out_of_stock,
        available_qty = EXCLUDED.current_qty,
        updated_at = NOW()
      RETURNING *
    `, [materialCode, materialName, categoryCode, categoryName, warehouseId, uom || "Nos", currentQty || 0, unitCost || 0, totalValue, minStockLevel || 0, maxStockLevel || 0, reorderQty || 0, locationBin, isBelow, isOut]);

    // Auto-generate reorder alert if below min
    if (isBelow && Number(currentQty || 0) > 0) {
      await query(`
        INSERT INTO reorder_alerts (material_stock_level_id, material_name, warehouse_id, current_qty, min_stock_level, shortage_qty, suggested_order_qty, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'Open')
        ON CONFLICT DO NOTHING
      `, [result.rows[0].id, materialName, warehouseId, currentQty, minStockLevel, Number(minStockLevel) - Number(currentQty), reorderQty || (Number(minStockLevel) - Number(currentQty))]);
    }

    res.status(201).json({ id: result.rows[0].id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/inventory/stock-levels/:id", requirePermission("inventory", "edit"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const { minStockLevel, maxStockLevel, reorderQty, unitCost, locationBin } = req.body;

    await query(`
      UPDATE material_stock_levels SET
        min_stock_level = COALESCE($1, min_stock_level),
        max_stock_level = COALESCE($2, max_stock_level),
        reorder_qty = COALESCE($3, reorder_qty),
        unit_cost = COALESCE($4, unit_cost),
        location_bin = COALESCE($5, location_bin),
        is_below_reorder = (current_qty < COALESCE($1, min_stock_level)),
        total_value = current_qty * COALESCE($4, unit_cost),
        updated_at = NOW()
      WHERE id = $6
    `, [minStockLevel, maxStockLevel, reorderQty, unitCost, locationBin, id]);

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── REORDER ANALYSIS ─────────────────────────────────────────────────────────
router.get("/inventory/reorder-analysis", async (req, res): Promise<void> => {
  try {
    const result = await query(`
      SELECT msl.*, w.name as warehouse_name,
        GREATEST(0, msl.min_stock_level - msl.current_qty) as shortage_qty
      FROM material_stock_levels msl
      LEFT JOIN warehouses w ON w.id = msl.warehouse_id
      WHERE msl.is_below_reorder = true OR msl.is_out_of_stock = true
      ORDER BY (msl.min_stock_level - msl.current_qty) DESC
    `);

    const openAlerts = await query(`SELECT * FROM reorder_alerts WHERE status = 'Open' ORDER BY shortage_qty DESC LIMIT 50`);

    res.json({
      items: result.rows.map(r => ({
        id: r.id,
        materialName: r.material_name,
        materialCode: r.material_code,
        categoryCode: r.category_code,
        warehouseId: r.warehouse_id,
        warehouseName: r.warehouse_name,
        uom: r.uom,
        currentQty: Number(r.current_qty),
        minStockLevel: Number(r.min_stock_level || 0),
        maxStockLevel: Number(r.max_stock_level || 0),
        reorderQty: Number(r.reorder_qty || 0),
        shortageQty: Number(r.shortage_qty || 0),
        isOutOfStock: r.is_out_of_stock,
        unitCost: Number(r.unit_cost || 0),
        estimatedOrderValue: Number(r.reorder_qty || 0) * Number(r.unit_cost || 0),
      })),
      openAlerts: openAlerts.rows.map(r => ({
        id: r.id,
        materialName: r.material_name,
        warehouseId: r.warehouse_id,
        warehouseName: r.warehouse_name,
        currentQty: Number(r.current_qty || 0),
        shortageQty: Number(r.shortage_qty || 0),
        suggestedOrderQty: Number(r.suggested_order_qty || 0),
        status: r.status,
        createdAt: r.created_at,
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/inventory/reorder-alerts/:id/acknowledge", requirePermission("inventory", "edit"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const user = (req as any).user;
    await query(`
      UPDATE reorder_alerts SET status = 'Acknowledged', acknowledged_by = $1, acknowledged_by_name = $2, acknowledged_at = NOW()
      WHERE id = $3
    `, [user?.id, user?.name, id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── PROJECT MATERIAL ALLOCATIONS ──────────────────────────────────────────────
router.get("/inventory/allocations", async (req, res): Promise<void> => {
  try {
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let pi = 1;
    if (req.query.status) { whereClause += ` AND status = $${pi++}`; params.push(req.query.status); }
    if (req.query.projectId) { whereClause += ` AND project_id = $${pi++}`; params.push(Number(req.query.projectId)); }
    if (req.query.warehouseId) { whereClause += ` AND warehouse_id = $${pi++}`; params.push(Number(req.query.warehouseId)); }
    if (req.query.search) { whereClause += ` AND (material_name ILIKE $${pi} OR project_name ILIKE $${pi} OR allocation_number ILIKE $${pi})`; params.push(`%${req.query.search}%`); pi++; }

    const result = await query(`SELECT * FROM project_material_allocations ${whereClause} ORDER BY created_at DESC LIMIT 200`, params);
    res.json(result.rows.map(fmtAllocation));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/inventory/allocations/:id", async (req, res): Promise<void> => {
  try {
    const result = await query(`SELECT * FROM project_material_allocations WHERE id = $1`, [parseInt(req.params.id)]);
    if (!result.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(fmtAllocation(result.rows[0]));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/inventory/allocations", requirePermission("inventory", "create"), async (req, res): Promise<void> => {
  try {
    const user = (req as any).user;
    const {
      projectId, projectName, warehouseId, warehouseName,
      materialId, materialCode, materialName, categoryCode, uom,
      requestedQty, purpose, requiredDate, remarks, unitCost
    } = req.body;

    if (!materialName || !warehouseId) { res.status(400).json({ error: "materialName and warehouseId required" }); return; }

    const allocNum = nextAllocationNumber();
    const totalValue = Number(requestedQty || 0) * Number(unitCost || 0);
    const result = await query(`
      INSERT INTO project_material_allocations
        (allocation_number, project_id, project_name, warehouse_id, warehouse_name, material_id, material_code, material_name, category_code, uom, requested_qty, allocated_qty, unit_cost, total_value, purpose, required_date, remarks, status, created_by, created_by_name, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,$13,$14,$15,$16,'Draft',$17,$18,NOW(),NOW())
      RETURNING *
    `, [allocNum, projectId, projectName, warehouseId, warehouseName, materialId, materialCode, materialName, categoryCode, uom || "Nos", requestedQty || 0, unitCost || 0, totalValue, purpose, requiredDate, remarks, user?.id, user?.name]);

    res.status(201).json(fmtAllocation(result.rows[0]));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/inventory/allocations/:id/approve", requirePermission("inventory", "approve"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const user = (req as any).user;
    const { allocatedQty } = req.body;

    const check = await query(`SELECT * FROM project_material_allocations WHERE id = $1`, [id]);
    if (!check.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    if (check.rows[0].status !== "Draft") { res.status(409).json({ error: "Can only approve Draft allocations" }); return; }

    const qty = allocatedQty || check.rows[0].requested_qty;

    // Check stock availability
    const stock = await query(
      `SELECT current_qty, available_qty FROM material_stock_levels WHERE material_name = $1 AND warehouse_id = $2`,
      [check.rows[0].material_name, check.rows[0].warehouse_id]
    );
    if (stock.rows[0] && Number(stock.rows[0].available_qty) < Number(qty)) {
      res.status(409).json({ error: `Insufficient stock. Available: ${stock.rows[0].available_qty}, Requested: ${qty}` });
      return;
    }

    await query(`
      UPDATE project_material_allocations SET
        status = 'Approved', allocated_qty = $1, approved_by = $2, approved_by_name = $3, approved_at = NOW(), updated_at = NOW()
      WHERE id = $4
    `, [qty, user?.id, user?.name, id]);

    // Reserve stock
    if (stock.rows[0]) {
      await query(
        `UPDATE material_stock_levels SET allocated_qty = allocated_qty + $1, available_qty = available_qty - $1, updated_at = NOW() WHERE material_name = $2 AND warehouse_id = $3`,
        [qty, check.rows[0].material_name, check.rows[0].warehouse_id]
      );
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/inventory/allocations/:id/issue", requirePermission("inventory", "edit"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const user = (req as any).user;
    const { issuedQty } = req.body;

    const check = await query(`SELECT * FROM project_material_allocations WHERE id = $1`, [id]);
    if (!check.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    if (!["Approved", "PartiallyIssued"].includes(check.rows[0].status)) {
      res.status(409).json({ error: "Can only issue Approved or PartiallyIssued allocations" });
      return;
    }

    const qty = Number(issuedQty || check.rows[0].allocated_qty);
    const newIssued = Number(check.rows[0].issued_qty || 0) + qty;
    const allocQty = Number(check.rows[0].allocated_qty);
    const newStatus = newIssued >= allocQty ? "Issued" : "PartiallyIssued";

    await query(`
      UPDATE project_material_allocations SET
        issued_qty = $1, status = $2, issued_by = $3, issued_by_name = $4, issued_at = NOW(), updated_at = NOW()
      WHERE id = $5
    `, [newIssued, newStatus, user?.id, user?.name, id]);

    // Write stock ledger (outward)
    await query(`
      INSERT INTO stock_ledger (warehouse_id, item_name, txn_type, qty, balance_qty, ref_doc_type, ref_doc_id, date, created_at)
      SELECT $1, $2, 'Outward', $3, COALESCE((SELECT current_qty FROM material_stock_levels WHERE material_name=$2 AND warehouse_id=$1),0)-$3, 'MaterialAllocation', $4, CURRENT_DATE, NOW()
    `, [check.rows[0].warehouse_id, check.rows[0].material_name, qty, id]);

    // Deduct from current stock
    await query(
      `UPDATE material_stock_levels SET current_qty = current_qty - $1, allocated_qty = allocated_qty - $2, available_qty = GREATEST(0, available_qty), is_out_of_stock = (current_qty - $1 <= 0), is_below_reorder = (current_qty - $1 < min_stock_level), total_value = (current_qty - $1) * unit_cost, last_issued_date = CURRENT_DATE::text, updated_at = NOW() WHERE material_name = $3 AND warehouse_id = $4`,
      [qty, qty, check.rows[0].material_name, check.rows[0].warehouse_id]
    );

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/inventory/allocations/:id/cancel", requirePermission("inventory", "delete"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const check = await query(`SELECT * FROM project_material_allocations WHERE id = $1`, [id]);
    if (!check.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    if (["Issued", "Closed", "Cancelled"].includes(check.rows[0].status)) {
      res.status(409).json({ error: "Cannot cancel this allocation" });
      return;
    }

    await query(`UPDATE project_material_allocations SET status = 'Cancelled', updated_at = NOW() WHERE id = $1`, [id]);

    // Release reserved stock
    if (check.rows[0].status === "Approved") {
      await query(
        `UPDATE material_stock_levels SET allocated_qty = GREATEST(0, allocated_qty - $1), available_qty = available_qty + $1, updated_at = NOW() WHERE material_name = $2 AND warehouse_id = $3`,
        [check.rows[0].allocated_qty, check.rows[0].material_name, check.rows[0].warehouse_id]
      );
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

function fmtAllocation(r: any) {
  return {
    id: r.id,
    allocationNumber: r.allocation_number,
    projectId: r.project_id,
    projectName: r.project_name,
    warehouseId: r.warehouse_id,
    warehouseName: r.warehouse_name,
    materialId: r.material_id,
    materialCode: r.material_code,
    materialName: r.material_name,
    categoryCode: r.category_code,
    uom: r.uom,
    requestedQty: Number(r.requested_qty || 0),
    allocatedQty: Number(r.allocated_qty || 0),
    issuedQty: Number(r.issued_qty || 0),
    returnedQty: Number(r.returned_qty || 0),
    consumedQty: Number(r.consumed_qty || 0),
    unitCost: Number(r.unit_cost || 0),
    totalValue: Number(r.total_value || 0),
    status: r.status,
    purpose: r.purpose,
    requiredDate: r.required_date,
    approvedBy: r.approved_by,
    approvedByName: r.approved_by_name,
    approvedAt: r.approved_at,
    issuedBy: r.issued_by,
    issuedByName: r.issued_by_name,
    issuedAt: r.issued_at,
    remarks: r.remarks,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
  };
}

// ── MATERIAL RETURNS ──────────────────────────────────────────────────────────
router.get("/inventory/returns", async (req, res): Promise<void> => {
  try {
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let pi = 1;
    if (req.query.status) { whereClause += ` AND status = $${pi++}`; params.push(req.query.status); }
    if (req.query.warehouseId) { whereClause += ` AND to_warehouse_id = $${pi++}`; params.push(Number(req.query.warehouseId)); }
    if (req.query.projectId) { whereClause += ` AND project_id = $${pi++}`; params.push(Number(req.query.projectId)); }

    const result = await query(`SELECT * FROM material_returns ${whereClause} ORDER BY created_at DESC LIMIT 200`, params);
    res.json(result.rows.map(fmtReturn));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/inventory/returns/:id", async (req, res): Promise<void> => {
  try {
    const result = await query(`SELECT * FROM material_returns WHERE id = $1`, [parseInt(req.params.id)]);
    if (!result.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(fmtReturn(result.rows[0]));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/inventory/returns", requirePermission("inventory", "create"), async (req, res): Promise<void> => {
  try {
    const user = (req as any).user;
    const { projectId, projectName, fromSite, toWarehouseId, toWarehouseName, allocationId, returnDate, reason, condition, remarks, items } = req.body;

    if (!toWarehouseId) { res.status(400).json({ error: "toWarehouseId required" }); return; }

    const retNum = nextReturnNumber();
    const result = await query(`
      INSERT INTO material_returns
        (return_number, project_id, project_name, from_site, to_warehouse_id, to_warehouse_name, allocation_id, return_date, reason, condition, remarks, items, total_items, initiated_by, initiated_by_name, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'Draft',NOW(),NOW())
      RETURNING *
    `, [retNum, projectId, projectName, fromSite, toWarehouseId, toWarehouseName, allocationId, returnDate, reason, condition || "Good", remarks, JSON.stringify(items || []), (items || []).length, user?.id, user?.name]);

    res.status(201).json(fmtReturn(result.rows[0]));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/inventory/returns/:id/receive", requirePermission("inventory", "edit"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const user = (req as any).user;
    const check = await query(`SELECT * FROM material_returns WHERE id = $1`, [id]);
    if (!check.rows[0]) { res.status(404).json({ error: "Not found" }); return; }

    const ret = check.rows[0];
    await query(`
      UPDATE material_returns SET
        status = 'Received', received_by = $1, received_by_name = $2, received_at = NOW(),
        received_date = CURRENT_DATE::text, updated_at = NOW()
      WHERE id = $3
    `, [user?.id, user?.name, id]);

    // Update stock levels for returned items
    const items: any[] = ret.items || [];
    for (const item of items) {
      if (item.materialName && item.qty) {
        // Upsert stock level
        await query(`
          INSERT INTO material_stock_levels (material_name, warehouse_id, uom, current_qty, available_qty, total_value, last_received_date, updated_at)
          VALUES ($1, $2, $3, $4, $4, $4 * COALESCE($5, 0), CURRENT_DATE::text, NOW())
          ON CONFLICT (material_name, warehouse_id) DO UPDATE SET
            current_qty = material_stock_levels.current_qty + $4,
            available_qty = material_stock_levels.available_qty + $4,
            total_value = (material_stock_levels.current_qty + $4) * material_stock_levels.unit_cost,
            last_received_date = CURRENT_DATE::text,
            is_out_of_stock = false,
            updated_at = NOW()
        `, [item.materialName, ret.to_warehouse_id, item.uom || "Nos", item.qty, item.unitCost || 0]);

        // Stock ledger entry
        await query(`
          INSERT INTO stock_ledger (warehouse_id, item_name, txn_type, qty, balance_qty, ref_doc_type, ref_doc_id, date, created_at)
          SELECT $1, $2, 'Inward', $3,
            COALESCE((SELECT current_qty FROM material_stock_levels WHERE material_name=$2 AND warehouse_id=$1), 0),
            'MaterialReturn', $4, CURRENT_DATE, NOW()
        `, [ret.to_warehouse_id, item.materialName, item.qty, id]);
      }
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/inventory/returns/:id/close", requirePermission("inventory", "edit"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    await query(`UPDATE material_returns SET status = 'Closed', updated_at = NOW() WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

function fmtReturn(r: any) {
  return {
    id: r.id,
    returnNumber: r.return_number,
    projectId: r.project_id,
    projectName: r.project_name,
    fromSite: r.from_site,
    toWarehouseId: r.to_warehouse_id,
    toWarehouseName: r.to_warehouse_name,
    allocationId: r.allocation_id,
    status: r.status,
    returnDate: r.return_date,
    receivedDate: r.received_date,
    reason: r.reason,
    condition: r.condition,
    remarks: r.remarks,
    initiatedBy: r.initiated_by,
    initiatedByName: r.initiated_by_name,
    receivedBy: r.received_by,
    receivedByName: r.received_by_name,
    receivedAt: r.received_at,
    items: r.items || [],
    totalItems: r.total_items || 0,
    createdAt: r.created_at,
  };
}

// ── INVENTORY AUDIT ITEMS ─────────────────────────────────────────────────────
router.get("/inventory/audits/:auditId/items", async (req, res): Promise<void> => {
  try {
    const result = await query(
      `SELECT * FROM inventory_audit_items WHERE audit_id = $1 ORDER BY id`,
      [parseInt(req.params.auditId)]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      auditId: r.audit_id,
      materialName: r.material_name,
      materialCode: r.material_code,
      uom: r.uom,
      systemQty: Number(r.system_qty || 0),
      physicalQty: r.physical_qty !== null ? Number(r.physical_qty) : null,
      varianceQty: r.variance_qty !== null ? Number(r.variance_qty) : null,
      varianceValue: r.variance_value !== null ? Number(r.variance_value) : null,
      unitCost: Number(r.unit_cost || 0),
      locationBin: r.location_bin,
      status: r.status,
      notes: r.notes,
      countedByName: r.counted_by_name,
      countedAt: r.counted_at,
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/inventory/audits/:auditId/items", requirePermission("inventory", "create"), async (req, res): Promise<void> => {
  try {
    const auditId = parseInt(req.params.auditId as string);
    const user = (req as any).user;
    const { materialName, materialCode, uom, systemQty, physicalQty, unitCost, locationBin, notes } = req.body;

    if (!materialName) { res.status(400).json({ error: "materialName required" }); return; }

    const varQty = physicalQty !== undefined ? Number(physicalQty) - Number(systemQty || 0) : null;
    const varVal = varQty !== null ? varQty * Number(unitCost || 0) : null;

    const result = await query(`
      INSERT INTO inventory_audit_items
        (audit_id, material_name, material_code, uom, system_qty, physical_qty, variance_qty, variance_value, unit_cost, location_bin, notes, status, counted_by, counted_by_name, counted_at, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())
      RETURNING id
    `, [auditId, materialName, materialCode, uom || "Nos", systemQty || 0, physicalQty, varQty, varVal, unitCost || 0, locationBin, notes, physicalQty !== undefined ? "Counted" : "Pending", user?.id, user?.name]);

    res.status(201).json({ id: result.rows[0].id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/inventory/audits/:auditId/items/:itemId", requirePermission("inventory", "edit"), async (req, res): Promise<void> => {
  try {
    const itemId = parseInt(req.params.itemId as string);
    const user = (req as any).user;
    const { physicalQty, notes } = req.body;

    const curr = await query(`SELECT * FROM inventory_audit_items WHERE id = $1`, [itemId]);
    if (!curr.rows[0]) { res.status(404).json({ error: "Not found" }); return; }

    const varQty = Number(physicalQty) - Number(curr.rows[0].system_qty || 0);
    const varVal = varQty * Number(curr.rows[0].unit_cost || 0);

    await query(`
      UPDATE inventory_audit_items SET
        physical_qty = $1, variance_qty = $2, variance_value = $3, notes = COALESCE($4, notes),
        status = 'Counted', counted_by = $5, counted_by_name = $6, counted_at = NOW()
      WHERE id = $7
    `, [physicalQty, varQty, varVal, notes, user?.id, user?.name, itemId]);

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── ENHANCED WAREHOUSES (new fields) ─────────────────────────────────────────
router.get("/inventory/warehouses-enhanced", async (req, res): Promise<void> => {
  try {
    const result = await query(`
      SELECT w.*,
        COUNT(DISTINCT msl.id) as sku_count,
        COALESCE(SUM(msl.current_qty), 0) as total_items,
        COALESCE(SUM(msl.total_value), 0) as total_value,
        COUNT(CASE WHEN msl.is_below_reorder THEN 1 END) as below_reorder_count
      FROM warehouses w
      LEFT JOIN material_stock_levels msl ON msl.warehouse_id = w.id
      GROUP BY w.id
      ORDER BY w.name
    `);

    res.json(result.rows.map(r => ({
      id: r.id,
      name: r.name,
      warehouseCode: r.warehouse_code,
      location: r.location,
      type: r.type,
      capacity: r.capacity,
      isActive: r.is_active,
      contactPerson: r.contact_person,
      phone: r.phone,
      email: r.email,
      address: r.address,
      gstNumber: r.gst_number,
      managerName: r.manager_name,
      description: r.description,
      skuCount: Number(r.sku_count),
      totalItems: Number(r.total_items),
      totalValue: Number(r.total_value),
      belowReorderCount: Number(r.below_reorder_count),
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/inventory/warehouses-enhanced/:id", requirePermission("inventory", "edit"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const { warehouseCode, contactPerson, phone, email, address, gstNumber, managerName, description, isActive } = req.body;
    await query(`
      UPDATE warehouses SET
        warehouse_code = COALESCE($1, warehouse_code),
        contact_person = COALESCE($2, contact_person),
        phone = COALESCE($3, phone),
        email = COALESCE($4, email),
        address = COALESCE($5, address),
        gst_number = COALESCE($6, gst_number),
        manager_name = COALESCE($7, manager_name),
        description = COALESCE($8, description),
        is_active = COALESCE($9, is_active),
        updated_at = NOW()
      WHERE id = $10
    `, [warehouseCode, contactPerson, phone, email, address, gstNumber, managerName, description, isActive, id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── STOCK AGING REPORT ────────────────────────────────────────────────────────
router.get("/inventory/stock-aging", async (req, res): Promise<void> => {
  try {
    const result = await query(`
      SELECT
        msl.*,
        w.name as warehouse_name,
        CASE
          WHEN msl.last_received_date IS NULL THEN 'Unknown'
          WHEN (CURRENT_DATE - msl.last_received_date::date) <= 30 THEN '0-30 days'
          WHEN (CURRENT_DATE - msl.last_received_date::date) <= 60 THEN '31-60 days'
          WHEN (CURRENT_DATE - msl.last_received_date::date) <= 90 THEN '61-90 days'
          WHEN (CURRENT_DATE - msl.last_received_date::date) <= 180 THEN '91-180 days'
          ELSE '180+ days'
        END as aging_bucket,
        CASE WHEN msl.last_received_date IS NOT NULL
          THEN (CURRENT_DATE - msl.last_received_date::date)
          ELSE NULL
        END as days_since_received
      FROM material_stock_levels msl
      LEFT JOIN warehouses w ON w.id = msl.warehouse_id
      WHERE msl.current_qty > 0
      ORDER BY days_since_received DESC NULLS LAST
    `);

    res.json(result.rows.map(r => ({
      id: r.id,
      materialName: r.material_name,
      categoryCode: r.category_code,
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouse_name,
      currentQty: Number(r.current_qty),
      uom: r.uom,
      unitCost: Number(r.unit_cost || 0),
      totalValue: Number(r.total_value || 0),
      lastReceivedDate: r.last_received_date,
      daysSinceReceived: r.days_since_received ? Number(r.days_since_received) : null,
      agingBucket: r.aging_bucket,
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
