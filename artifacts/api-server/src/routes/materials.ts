import { Router, type IRouter } from "express";
import { db, materialCategoriesTable, materialsTable } from "@workspace/db";
import { eq, desc, ilike, or } from "drizzle-orm";

const router: IRouter = Router();

let matCounter = 1;
(async () => {
  const rows = await db.select().from(materialsTable).orderBy(desc(materialsTable.id)).limit(1);
  if (rows.length > 0) matCounter = rows[0].id + 1;
})();

function fmtMaterial(m: typeof materialsTable.$inferSelect) {
  return {
    id: m.id, code: m.code, name: m.name, description: m.description,
    categoryId: m.categoryId, uom: m.uom,
    hsnSacCode: m.hsnSacCode, gstRate: m.gstRate ? Number(m.gstRate) : 18, cessRate: m.cessRate ? Number(m.cessRate) : 0,
    basePrice: m.basePrice ? Number(m.basePrice) : null,
    lastPurchasePrice: m.lastPurchasePrice ? Number(m.lastPurchasePrice) : null,
    currency: m.currency, brand: m.brand, model: m.model, specifications: m.specifications,
    minOrderQty: m.minOrderQty ? Number(m.minOrderQty) : null, leadTimeDays: m.leadTimeDays,
    isActive: m.isActive, createdBy: m.createdBy, updatedBy: m.updatedBy,
    createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString(),
  };
}

// ── CATEGORIES ────────────────────────────────────────────────────────────────
router.get("/material-categories", async (req, res): Promise<void> => {
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

// ── MATERIALS ─────────────────────────────────────────────────────────────────
router.get("/materials", async (req, res): Promise<void> => {
  let rows = await db.select().from(materialsTable).orderBy(materialsTable.name);
  if (req.query.search) {
    const s = `%${req.query.search}%`;
    rows = await db.select().from(materialsTable)
      .where(or(ilike(materialsTable.name, s), ilike(materialsTable.code, s), ilike(materialsTable.hsnSacCode, s)))
      .orderBy(materialsTable.name);
  }
  if (req.query.categoryId) {
    rows = rows.filter(r => r.categoryId === Number(req.query.categoryId));
  }
  if (req.query.isActive !== undefined) {
    rows = rows.filter(r => r.isActive === (req.query.isActive === "true"));
  }
  res.json(rows.map(fmtMaterial));
});

router.post("/materials", async (req, res): Promise<void> => {
  const code = `MAT-${String(matCounter++).padStart(4, "0")}`;
  const { gstRate, cessRate, basePrice, lastPurchasePrice, minOrderQty, ...rest } = req.body;
  const [row] = await db.insert(materialsTable).values({
    ...rest, code,
    gstRate: gstRate?.toString(), cessRate: cessRate?.toString(),
    basePrice: basePrice?.toString(), lastPurchasePrice: lastPurchasePrice?.toString(),
    minOrderQty: minOrderQty?.toString(),
  }).returning();
  res.status(201).json(fmtMaterial(row));
});

router.get("/materials/:id", async (req, res): Promise<void> => {
  const [row] = await db.select().from(materialsTable).where(eq(materialsTable.id, Number(req.params.id)));
  if (!row) { res.status(404).json({ error: "Material not found" }); return; }
  res.json(fmtMaterial(row));
});

router.patch("/materials/:id", async (req, res): Promise<void> => {
  const { gstRate, cessRate, basePrice, lastPurchasePrice, minOrderQty, ...rest } = req.body;
  const [row] = await db.update(materialsTable).set({
    ...rest, updatedAt: new Date(),
    gstRate: gstRate?.toString(), cessRate: cessRate?.toString(),
    basePrice: basePrice?.toString(), lastPurchasePrice: lastPurchasePrice?.toString(),
    minOrderQty: minOrderQty?.toString(),
  }).where(eq(materialsTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Material not found" }); return; }
  res.json(fmtMaterial(row));
});

router.delete("/materials/:id", async (req, res): Promise<void> => {
  await db.delete(materialsTable).where(eq(materialsTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;
