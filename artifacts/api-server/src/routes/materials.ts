import { Router, type IRouter } from "express";
import { db, materialCategoriesTable, materialsTable, materialSuppliersTable, materialAuditLogsTable } from "@workspace/db";
import { eq, desc, ilike, or, and, gte, lte, inArray, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router: IRouter = Router();

/* ── Auth helper ─────────────────────────────────────────────────────────── */
function getUser(req: any): { id: number; name: string } | null {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.SESSION_SECRET!) as any;
    return { id: decoded.userId, name: decoded.name ?? decoded.email ?? "Unknown" };
  } catch { return null; }
}

/* ── Format helpers ──────────────────────────────────────────────────────── */
function n(v: unknown) { return v !== null && v !== undefined ? Number(v) : null; }

function fmtMaterial(m: typeof materialsTable.$inferSelect, categoryName?: string) {
  return {
    id: m.id, code: m.code, name: m.name, description: m.description,
    categoryId: m.categoryId, categoryName: categoryName ?? null, uom: m.uom,
    hsnSacCode: m.hsnSacCode,
    gstRate: n(m.gstRate) ?? 18,
    cessRate: n(m.cessRate) ?? 0,
    basePrice: n(m.basePrice),
    lastPurchasePrice: n(m.lastPurchasePrice),
    currency: m.currency ?? "INR",
    brand: m.brand, model: m.model, specifications: m.specifications,
    minOrderQty: n(m.minOrderQty), leadTimeDays: m.leadTimeDays,
    minStockLevel: n(m.minStockLevel), maxStockLevel: n(m.maxStockLevel), reorderPoint: n(m.reorderPoint),
    isActive: m.isActive,
    createdBy: m.createdBy, updatedBy: m.updatedBy,
    createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString(),
  };
}

function fmtSupplier(s: typeof materialSuppliersTable.$inferSelect) {
  return {
    id: s.id, materialId: s.materialId, vendorId: s.vendorId, vendorName: s.vendorName,
    supplierPartCode: s.supplierPartCode, unitPrice: n(s.unitPrice), currency: s.currency ?? "INR",
    leadTimeDays: s.leadTimeDays, minOrderQty: n(s.minOrderQty),
    isPreferred: s.isPreferred,
    notes: s.notes,
    createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(),
  };
}

async function writeAudit(materialId: number, action: string, opts: {
  user?: { id: number; name: string } | null;
  field?: string; oldVal?: string; newVal?: string; notes?: string;
}) {
  await db.insert(materialAuditLogsTable).values({
    materialId, action,
    fieldChanged: opts.field ?? null,
    oldValue: opts.oldVal ?? null,
    newValue: opts.newVal ?? null,
    performedBy: opts.user?.id ?? null,
    performedByName: opts.user?.name ?? null,
    notes: opts.notes ?? null,
  });
}

/* ─── Counter init ──────────────────────────────────────────────────────── */
let matCounter = 1;
(async () => {
  const rows = await db.select({ id: materialsTable.id })
    .from(materialsTable).orderBy(desc(materialsTable.id)).limit(1);
  if (rows.length > 0) matCounter = rows[0].id + 1;
})();

/* ════════════════════════════════════════════════════════════════════════
   CATEGORIES
════════════════════════════════════════════════════════════════════════ */
router.get("/material-categories", async (_req, res): Promise<void> => {
  const rows = await db.select().from(materialCategoriesTable).orderBy(materialCategoriesTable.name);
  res.json(rows);
});

router.post("/material-categories", async (req, res): Promise<void> => {
  const [row] = await db.insert(materialCategoriesTable).values(req.body).returning();
  res.status(201).json(row);
});

router.patch("/material-categories/:id", async (req, res): Promise<void> => {
  const [row] = await db.update(materialCategoriesTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(materialCategoriesTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Category not found" }); return; }
  res.json(row);
});

router.delete("/material-categories/:id", async (req, res): Promise<void> => {
  await db.delete(materialCategoriesTable).where(eq(materialCategoriesTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

/* ════════════════════════════════════════════════════════════════════════
   MATERIALS — special routes BEFORE /:id
════════════════════════════════════════════════════════════════════════ */

/* ── GET /materials/export — CSV download ─────────────────────────────── */
router.get("/materials/export", async (req, res): Promise<void> => {
  const categories = await db.select().from(materialCategoriesTable);
  const catMap = new Map(categories.map(c => [c.id, c.name]));

  let rows = await db.select().from(materialsTable).orderBy(materialsTable.name);
  if (req.query.categoryId) rows = rows.filter(r => r.categoryId === Number(req.query.categoryId));
  if (req.query.status === "active") rows = rows.filter(r => r.isActive);
  if (req.query.status === "inactive") rows = rows.filter(r => !r.isActive);

  const header = ["code","name","category","uom","brand","model","description","specifications",
    "hsnSacCode","gstRate","cessRate","basePrice","lastPurchasePrice","currency",
    "minOrderQty","leadTimeDays","minStockLevel","maxStockLevel","reorderPoint","isActive"].join(",");

  const csvRows = rows.map(m => [
    m.code ?? "", `"${(m.name ?? "").replace(/"/g, '""')}"`,
    `"${catMap.get(m.categoryId ?? 0) ?? ""}"`,
    m.uom ?? "", m.brand ?? "", m.model ?? "",
    `"${(m.description ?? "").replace(/"/g, '""')}"`,
    `"${(m.specifications ?? "").replace(/"/g, '""')}"`,
    m.hsnSacCode ?? "", m.gstRate ?? 18, m.cessRate ?? 0,
    m.basePrice ?? "", m.lastPurchasePrice ?? "", m.currency ?? "INR",
    m.minOrderQty ?? "", m.leadTimeDays ?? "",
    m.minStockLevel ?? "", m.maxStockLevel ?? "", m.reorderPoint ?? "",
    m.isActive ? "true" : "false",
  ].join(","));

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="materials-catalogue-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send([header, ...csvRows].join("\n"));
});

/* ── POST /materials/import — bulk CSV import ─────────────────────────── */
router.post("/materials/import", async (req, res): Promise<void> => {
  const user = getUser(req);
  const items: any[] = req.body.items ?? [];
  if (!items.length) { res.status(400).json({ error: "No items provided" }); return; }

  const categories = await db.select().from(materialCategoriesTable);
  const catNameMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

  const inserted: any[] = [];
  for (const item of items) {
    const categoryId = item.category ? (catNameMap.get(item.category.toLowerCase()) ?? null) : null;
    const code = `MAT-${String(matCounter++).padStart(4, "0")}`;
    const [row] = await db.insert(materialsTable).values({
      code, name: item.name, description: item.description ?? null,
      categoryId, uom: item.uom ?? "Nos",
      brand: item.brand ?? null, model: item.model ?? null,
      specifications: item.specifications ?? null,
      hsnSacCode: item.hsnSacCode ?? null,
      gstRate: item.gstRate?.toString() ?? "18",
      cessRate: item.cessRate?.toString() ?? "0",
      basePrice: item.basePrice?.toString() ?? null,
      lastPurchasePrice: item.lastPurchasePrice?.toString() ?? null,
      currency: item.currency ?? "INR",
      minOrderQty: item.minOrderQty?.toString() ?? null,
      leadTimeDays: item.leadTimeDays ? Number(item.leadTimeDays) : null,
      minStockLevel: item.minStockLevel?.toString() ?? null,
      maxStockLevel: item.maxStockLevel?.toString() ?? null,
      reorderPoint: item.reorderPoint?.toString() ?? null,
      isActive: item.isActive !== "false" && item.isActive !== false,
      createdBy: user?.id ?? null,
    }).returning();
    await writeAudit(row.id, "created", { user, notes: "Imported via CSV" });
    inserted.push(fmtMaterial(row));
  }
  res.status(201).json({ inserted: inserted.length, items: inserted });
});

/* ── POST /materials/bulk — bulk operations ──────────────────────────── */
router.post("/materials/bulk", async (req, res): Promise<void> => {
  const user = getUser(req);
  const { action, ids }: { action: string; ids: number[] } = req.body;
  if (!ids?.length) { res.status(400).json({ error: "No IDs provided" }); return; }

  if (action === "activate") {
    await db.update(materialsTable).set({ isActive: true, updatedAt: new Date() })
      .where(inArray(materialsTable.id, ids));
    for (const id of ids) await writeAudit(id, "status_changed", { user, oldVal: "inactive", newVal: "active" });
  } else if (action === "deactivate") {
    await db.update(materialsTable).set({ isActive: false, updatedAt: new Date() })
      .where(inArray(materialsTable.id, ids));
    for (const id of ids) await writeAudit(id, "status_changed", { user, oldVal: "active", newVal: "inactive" });
  } else if (action === "delete") {
    await db.delete(materialsTable).where(inArray(materialsTable.id, ids));
  } else {
    res.status(400).json({ error: "Unknown action" }); return;
  }
  res.json({ ok: true, affected: ids.length });
});

/* ── POST /materials/seed — demo data ────────────────────────────────── */
router.post("/materials/seed", async (req, res): Promise<void> => {
  // Seed categories
  const catDefs = [
    { name: "Solar Modules", code: "SOL", description: "PV modules and panels" },
    { name: "Inverters", code: "INV", description: "String and central inverters" },
    { name: "Mounting Structure", code: "STR", description: "GI structures, purlins, clamps" },
    { name: "DC BOS", code: "DCB", description: "DC cables, connectors, junction boxes" },
    { name: "AC BOS", code: "ACB", description: "AC cables, panels, distribution boards" },
    { name: "Protection Devices", code: "PRO", description: "MCBs, MCCBs, SPDs, earthing" },
    { name: "Monitoring", code: "MON", description: "Dataloggers, sensors, weather stations" },
    { name: "Civil Materials", code: "CIV", description: "Cement, steel, aggregates" },
  ];

  const insertedCats: any[] = [];
  for (const cat of catDefs) {
    const existing = await db.select().from(materialCategoriesTable).where(eq(materialCategoriesTable.name, cat.name));
    if (existing.length === 0) {
      const [c] = await db.insert(materialCategoriesTable).values(cat).returning();
      insertedCats.push(c);
    } else {
      insertedCats.push(existing[0]);
    }
  }

  const catMap = new Map(insertedCats.map(c => [c.code, c.id]));

  const matDefs = [
    // Solar Modules
    { name: "540Wp Mono PERC Module", categoryCode: "SOL", uom: "Nos", brand: "Waaree", model: "WS-540", hsnSacCode: "85414011", gstRate: 12, basePrice: 14500, specifications: "Voc: 49.8V, Isc: 13.76A, Efficiency: 20.9%, Frame: Anodised Aluminium", minOrderQty: 26, leadTimeDays: 21, minStockLevel: 52, reorderPoint: 78 },
    { name: "550Wp Bifacial Module", categoryCode: "SOL", uom: "Nos", brand: "Adani Solar", model: "ADN-550BF", hsnSacCode: "85414011", gstRate: 12, basePrice: 16200, specifications: "Bifacial Gain: 10-15%, Voc: 50.2V, Dual Glass, Power Tolerance: 0/+5W", minOrderQty: 26, leadTimeDays: 25 },
    { name: "400Wp Half-Cut Mono Module", categoryCode: "SOL", uom: "Nos", brand: "Vikram Solar", model: "VS-400HC", hsnSacCode: "85414011", gstRate: 12, basePrice: 11800, minOrderQty: 40, leadTimeDays: 18 },
    // Inverters
    { name: "5kW String Inverter", categoryCode: "INV", uom: "Nos", brand: "SMA", model: "Sunny Boy 5.0", hsnSacCode: "85044090", gstRate: 18, basePrice: 42000, specifications: "Efficiency: 97.2%, MPPT: 2, IP65, 10-year warranty", leadTimeDays: 30, minStockLevel: 2, reorderPoint: 3 },
    { name: "10kW String Inverter", categoryCode: "INV", uom: "Nos", brand: "Fronius", model: "Symo 10.0", hsnSacCode: "85044090", gstRate: 18, basePrice: 78000, specifications: "Efficiency: 98.0%, MPPT: 2, SuperFlex Design", leadTimeDays: 35 },
    { name: "50kW Central Inverter", categoryCode: "INV", uom: "Nos", brand: "ABB", model: "TRIO-50", hsnSacCode: "85044090", gstRate: 18, basePrice: 320000, specifications: "3-phase, IP65, 12 MPPT, Remote monitoring", leadTimeDays: 45 },
    { name: "100kW Central Inverter", categoryCode: "INV", uom: "Nos", brand: "Huawei", model: "SUN2000-100KTL", hsnSacCode: "85044090", gstRate: 18, basePrice: 580000, leadTimeDays: 60 },
    // Mounting Structure
    { name: "GI C-Purlin 2mm (50x50x2500mm)", categoryCode: "STR", uom: "Nos", hsnSacCode: "72162100", gstRate: 18, basePrice: 420, minOrderQty: 100, leadTimeDays: 14, minStockLevel: 200, reorderPoint: 300 },
    { name: "GI Square Pipe 40x40x2mm", categoryCode: "STR", uom: "Mtr", hsnSacCode: "73063010", gstRate: 18, basePrice: 185, minOrderQty: 500, leadTimeDays: 10 },
    { name: "Module Clamp Kit (Mid+End)", categoryCode: "STR", uom: "Set", hsnSacCode: "73182990", gstRate: 18, basePrice: 65, minOrderQty: 200, leadTimeDays: 7 },
    { name: "L-Foot Roof Hook (Tile)", categoryCode: "STR", uom: "Nos", hsnSacCode: "73182990", gstRate: 18, basePrice: 210, minOrderQty: 50, leadTimeDays: 10 },
    // DC BOS
    { name: "DC Solar Cable 4mm² (Red)", categoryCode: "DCB", uom: "Mtr", hsnSacCode: "85444290", gstRate: 18, basePrice: 38, specifications: "H1Z2Z2-K, TUV Certified, 1.8kV DC, 90°C rated, UV resistant", minOrderQty: 500, leadTimeDays: 7, minStockLevel: 1000, reorderPoint: 1500 },
    { name: "DC Solar Cable 4mm² (Black)", categoryCode: "DCB", uom: "Mtr", hsnSacCode: "85444290", gstRate: 18, basePrice: 38, minOrderQty: 500, leadTimeDays: 7 },
    { name: "DC Solar Cable 6mm²", categoryCode: "DCB", uom: "Mtr", hsnSacCode: "85444290", gstRate: 18, basePrice: 52, minOrderQty: 300, leadTimeDays: 7 },
    { name: "MC4 Connector Pair (IP68)", categoryCode: "DCB", uom: "Pair", hsnSacCode: "85369090", gstRate: 18, basePrice: 42, brand: "Stäubli", minOrderQty: 100, leadTimeDays: 10 },
    { name: "DC Combiner Box 8-in-1-out", categoryCode: "DCB", uom: "Nos", hsnSacCode: "85369090", gstRate: 18, basePrice: 3200, specifications: "IP65, 10A Fuses per string, SPD Class II, Din Rail Mount", leadTimeDays: 14 },
    // AC BOS
    { name: "AC Cable 6mm² (3C+E)", categoryCode: "ACB", uom: "Mtr", hsnSacCode: "85444290", gstRate: 18, basePrice: 75, minOrderQty: 200, leadTimeDays: 7 },
    { name: "AC Cable 10mm² (3C+E)", categoryCode: "ACB", uom: "Mtr", hsnSacCode: "85444290", gstRate: 18, basePrice: 118, minOrderQty: 100, leadTimeDays: 7 },
    { name: "Main Distribution Board (63A TPN)", categoryCode: "ACB", uom: "Nos", hsnSacCode: "85371090", gstRate: 18, basePrice: 4500, leadTimeDays: 14 },
    { name: "Armoured Cable 35mm² (4C)", categoryCode: "ACB", uom: "Mtr", hsnSacCode: "85444290", gstRate: 18, basePrice: 385, minOrderQty: 100, leadTimeDays: 21 },
    // Protection Devices
    { name: "DC MCB 32A 1000V", categoryCode: "PRO", uom: "Nos", brand: "Legrand", hsnSacCode: "85362090", gstRate: 18, basePrice: 680, minOrderQty: 10, leadTimeDays: 7, minStockLevel: 20, reorderPoint: 30 },
    { name: "AC MCCB 63A 3P", categoryCode: "PRO", uom: "Nos", brand: "Schneider", model: "EasyPact CVS", hsnSacCode: "85362090", gstRate: 18, basePrice: 2800, minOrderQty: 5, leadTimeDays: 10 },
    { name: "SPD Class II DC (1000V)", categoryCode: "PRO", uom: "Nos", brand: "Phoenix Contact", hsnSacCode: "85363090", gstRate: 18, basePrice: 1850, leadTimeDays: 14 },
    { name: "Earthing Strip (GI 50x6mm)", categoryCode: "PRO", uom: "Mtr", hsnSacCode: "74199990", gstRate: 18, basePrice: 95, minOrderQty: 50, leadTimeDays: 7 },
    { name: "Earth Rod (Copper Bonded 1.5m)", categoryCode: "PRO", uom: "Nos", hsnSacCode: "74199990", gstRate: 18, basePrice: 680, minOrderQty: 5, leadTimeDays: 10 },
    // Monitoring
    { name: "Solar Datalogger (Modbus/RS485)", categoryCode: "MON", uom: "Nos", brand: "Delta", hsnSacCode: "85176200", gstRate: 18, basePrice: 8500, leadTimeDays: 21 },
    { name: "Ambient Weather Station", categoryCode: "MON", uom: "Nos", hsnSacCode: "90141000", gstRate: 18, basePrice: 22000, specifications: "GHI Sensor, Wind Speed, Temperature, Humidity, Modbus RTU", leadTimeDays: 30 },
    // Civil
    { name: "OPC Cement 43 Grade (50kg)", categoryCode: "CIV", uom: "Bag", hsnSacCode: "25232990", gstRate: 28, basePrice: 380, minOrderQty: 50, leadTimeDays: 3, minStockLevel: 100, reorderPoint: 150 },
    { name: "TMT Steel Bar Fe500 10mm", categoryCode: "CIV", uom: "MT", hsnSacCode: "72142090", gstRate: 18, basePrice: 62000, minOrderQty: 1, leadTimeDays: 5 },
    { name: "M-Sand (Fine Aggregate)", categoryCode: "CIV", uom: "MT", hsnSacCode: "25010090", gstRate: 5, basePrice: 1800, minOrderQty: 5, leadTimeDays: 2 },
  ];

  const inserted: any[] = [];
  for (const m of matDefs) {
    const { categoryCode, ...rest } = m as any;
    const categoryId = catMap.get(categoryCode) ?? null;
    const code = `MAT-${String(matCounter++).padStart(4, "0")}`;
    const [row] = await db.insert(materialsTable).values({
      code, categoryId,
      name: rest.name, description: rest.description ?? null,
      uom: rest.uom as any,
      brand: rest.brand ?? null, model: rest.model ?? null,
      specifications: rest.specifications ?? null,
      hsnSacCode: rest.hsnSacCode ?? null,
      gstRate: rest.gstRate?.toString() ?? "18",
      cessRate: "0",
      basePrice: rest.basePrice?.toString() ?? null,
      currency: "INR",
      minOrderQty: rest.minOrderQty?.toString() ?? null,
      leadTimeDays: rest.leadTimeDays ?? null,
      minStockLevel: rest.minStockLevel?.toString() ?? null,
      maxStockLevel: rest.maxStockLevel ? (rest.maxStockLevel * 3).toString() : null,
      reorderPoint: rest.reorderPoint?.toString() ?? null,
      isActive: true,
    }).returning();
    inserted.push(row.name);
  }

  res.json({ ok: true, categories: insertedCats.length, materials: inserted.length });
});

/* ════════════════════════════════════════════════════════════════════════
   MATERIALS — standard CRUD
════════════════════════════════════════════════════════════════════════ */
router.get("/materials", async (req, res): Promise<void> => {
  const categories = await db.select().from(materialCategoriesTable);
  const catMap = new Map(categories.map(c => [c.id, c.name]));

  const conditions: any[] = [];
  if (req.query.search) {
    const s = `%${req.query.search}%`;
    conditions.push(or(
      ilike(materialsTable.name, s),
      ilike(materialsTable.code, s),
      ilike(materialsTable.hsnSacCode, s),
      ilike(materialsTable.brand, s),
    ));
  }
  if (req.query.categoryId) conditions.push(eq(materialsTable.categoryId, Number(req.query.categoryId)));
  if (req.query.uom) conditions.push(eq(materialsTable.uom, req.query.uom as any));
  if (req.query.isActive !== undefined) conditions.push(eq(materialsTable.isActive, req.query.isActive === "true"));
  if (req.query.priceMin) conditions.push(gte(materialsTable.basePrice, req.query.priceMin as string));
  if (req.query.priceMax) conditions.push(lte(materialsTable.basePrice, req.query.priceMax as string));

  const rows = conditions.length
    ? await db.select().from(materialsTable).where(and(...conditions)).orderBy(materialsTable.name)
    : await db.select().from(materialsTable).orderBy(materialsTable.name);

  res.json(rows.map(m => fmtMaterial(m, m.categoryId ? catMap.get(m.categoryId) : undefined)));
});

router.post("/materials", async (req, res): Promise<void> => {
  const user = getUser(req);
  const code = `MAT-${String(matCounter++).padStart(4, "0")}`;
  const { gstRate, cessRate, basePrice, lastPurchasePrice, minOrderQty, minStockLevel, maxStockLevel, reorderPoint, ...rest } = req.body;
  const [row] = await db.insert(materialsTable).values({
    ...rest, code,
    gstRate: gstRate?.toString(), cessRate: cessRate?.toString(),
    basePrice: basePrice?.toString(), lastPurchasePrice: lastPurchasePrice?.toString(),
    minOrderQty: minOrderQty?.toString(),
    minStockLevel: minStockLevel?.toString(), maxStockLevel: maxStockLevel?.toString(),
    reorderPoint: reorderPoint?.toString(),
    createdBy: user?.id ?? null,
  }).returning();
  await writeAudit(row.id, "created", { user });
  res.status(201).json(fmtMaterial(row));
});

router.get("/materials/:id", async (req, res): Promise<void> => {
  const [row] = await db.select().from(materialsTable).where(eq(materialsTable.id, Number(req.params.id)));
  if (!row) { res.status(404).json({ error: "Material not found" }); return; }
  const [cat] = row.categoryId
    ? await db.select().from(materialCategoriesTable).where(eq(materialCategoriesTable.id, row.categoryId))
    : [null];
  res.json(fmtMaterial(row, cat?.name));
});

router.patch("/materials/:id", async (req, res): Promise<void> => {
  const user = getUser(req);
  const id = Number(req.params.id);
  const [existing] = await db.select().from(materialsTable).where(eq(materialsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Material not found" }); return; }

  const { gstRate, cessRate, basePrice, lastPurchasePrice, minOrderQty, minStockLevel, maxStockLevel, reorderPoint, ...rest } = req.body;
  const [row] = await db.update(materialsTable).set({
    ...rest, updatedAt: new Date(), updatedBy: user?.id ?? null,
    gstRate: gstRate?.toString(), cessRate: cessRate?.toString(),
    basePrice: basePrice?.toString(), lastPurchasePrice: lastPurchasePrice?.toString(),
    minOrderQty: minOrderQty?.toString(),
    minStockLevel: minStockLevel?.toString(), maxStockLevel: maxStockLevel?.toString(),
    reorderPoint: reorderPoint?.toString(),
  }).where(eq(materialsTable.id, id)).returning();

  // Audit significant field changes
  const auditable = ["name", "isActive", "basePrice", "categoryId", "uom", "hsnSacCode", "gstRate"] as const;
  for (const field of auditable) {
    const oldV = String(existing[field] ?? "");
    const newV = String(req.body[field] ?? existing[field] ?? "");
    if (field in req.body && oldV !== newV) {
      await writeAudit(id, "updated", { user, field, oldVal: oldV, newVal: newV });
    }
  }

  res.json(fmtMaterial(row));
});

router.delete("/materials/:id", async (req, res): Promise<void> => {
  await db.delete(materialsTable).where(eq(materialsTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

/* ════════════════════════════════════════════════════════════════════════
   SUPPLIERS
════════════════════════════════════════════════════════════════════════ */
router.get("/materials/:id/suppliers", async (req, res): Promise<void> => {
  const rows = await db.select().from(materialSuppliersTable)
    .where(eq(materialSuppliersTable.materialId, Number(req.params.id)))
    .orderBy(desc(materialSuppliersTable.isPreferred), materialSuppliersTable.vendorName);
  res.json(rows.map(fmtSupplier));
});

router.post("/materials/:id/suppliers", async (req, res): Promise<void> => {
  const user = getUser(req);
  const materialId = Number(req.params.id);
  const { unitPrice, minOrderQty, ...rest } = req.body;
  const [row] = await db.insert(materialSuppliersTable).values({
    ...rest, materialId,
    unitPrice: unitPrice?.toString() ?? null,
    minOrderQty: minOrderQty?.toString() ?? null,
  }).returning();
  await writeAudit(materialId, "supplier_added", { user, newVal: rest.vendorName });
  res.status(201).json(fmtSupplier(row));
});

router.patch("/materials/:id/suppliers/:sid", async (req, res): Promise<void> => {
  const user = getUser(req);
  const materialId = Number(req.params.id);
  const { unitPrice, minOrderQty, ...rest } = req.body;
  const [row] = await db.update(materialSuppliersTable).set({
    ...rest, updatedAt: new Date(),
    unitPrice: unitPrice?.toString() ?? null,
    minOrderQty: minOrderQty?.toString() ?? null,
  }).where(eq(materialSuppliersTable.id, Number(req.params.sid))).returning();
  if (!row) { res.status(404).json({ error: "Supplier not found" }); return; }
  await writeAudit(materialId, "supplier_updated", { user, newVal: row.vendorName });
  res.json(fmtSupplier(row));
});

router.delete("/materials/:id/suppliers/:sid", async (req, res): Promise<void> => {
  const user = getUser(req);
  const materialId = Number(req.params.id);
  const [row] = await db.select().from(materialSuppliersTable)
    .where(eq(materialSuppliersTable.id, Number(req.params.sid)));
  await db.delete(materialSuppliersTable).where(eq(materialSuppliersTable.id, Number(req.params.sid)));
  await writeAudit(materialId, "supplier_removed", { user, oldVal: row?.vendorName });
  res.json({ ok: true });
});

/* ════════════════════════════════════════════════════════════════════════
   AUDIT LOG
════════════════════════════════════════════════════════════════════════ */
router.get("/materials/:id/audit", async (req, res): Promise<void> => {
  const rows = await db.select().from(materialAuditLogsTable)
    .where(eq(materialAuditLogsTable.materialId, Number(req.params.id)))
    .orderBy(desc(materialAuditLogsTable.createdAt))
    .limit(100);
  res.json(rows.map(r => ({
    id: r.id, action: r.action, fieldChanged: r.fieldChanged,
    oldValue: r.oldValue, newValue: r.newValue,
    performedByName: r.performedByName, notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  })));
});

export default router;
