import { Router, type IRouter } from "express";
import { db, vendorsTable, vendorContactsTable } from "@workspace/db";
import { eq, desc, ilike, or } from "drizzle-orm";

const router: IRouter = Router();

let vendorCounter = 1;

function fmtVendor(v: typeof vendorsTable.$inferSelect, contacts: typeof vendorContactsTable.$inferSelect[] = []) {
  return {
    id: v.id, code: v.code, name: v.name, tradeName: v.tradeName, status: v.status,
    gstin: v.gstin, pan: v.pan, gstRegisteredState: v.gstRegisteredState, gstStateCode: v.gstStateCode,
    isMsme: v.isMsme, msmeNumber: v.msmeNumber,
    billingAddress: v.billingAddress, billingCity: v.billingCity, billingState: v.billingState,
    billingPincode: v.billingPincode, billingCountry: v.billingCountry,
    primaryEmail: v.primaryEmail, primaryPhone: v.primaryPhone, website: v.website,
    bankName: v.bankName, bankBranch: v.bankBranch, bankAccountNumber: v.bankAccountNumber,
    bankIfsc: v.bankIfsc, bankAccountType: v.bankAccountType, upiId: v.upiId,
    paymentTerms: v.paymentTerms, creditLimit: v.creditLimit, tags: v.tags, notes: v.notes,
    contacts,
    createdBy: v.createdBy, updatedBy: v.updatedBy,
    createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString(),
  };
}

// Seed counter from DB
(async () => {
  const rows = await db.select().from(vendorsTable).orderBy(desc(vendorsTable.id)).limit(1);
  if (rows.length > 0) vendorCounter = rows[0].id + 1;
})();

// ── LIST vendors ──────────────────────────────────────────────────────────────
router.get("/vendors", async (req, res): Promise<void> => {
  let rows = await db.select().from(vendorsTable).orderBy(vendorsTable.name);
  if (req.query.search) {
    const s = `%${req.query.search}%`;
    rows = await db.select().from(vendorsTable)
      .where(or(ilike(vendorsTable.name, s), ilike(vendorsTable.gstin, s), ilike(vendorsTable.primaryEmail, s)))
      .orderBy(vendorsTable.name);
  }
  if (req.query.status) {
    rows = rows.filter(r => r.status === req.query.status);
  }
  res.json(rows.map(r => fmtVendor(r)));
});

// ── CREATE vendor ─────────────────────────────────────────────────────────────
router.post("/vendors", async (req, res): Promise<void> => {
  const { contacts: contactsBody, ...body } = req.body;
  const code = `VND-${String(vendorCounter++).padStart(4, "0")}`;
  const [row] = await db.insert(vendorsTable).values({ ...body, code }).returning();
  let contacts: typeof vendorContactsTable.$inferSelect[] = [];
  if (contactsBody?.length) {
    contacts = await db.insert(vendorContactsTable)
      .values(contactsBody.map((c: any) => ({ ...c, vendorId: row.id })))
      .returning();
  }
  res.status(201).json(fmtVendor(row, contacts));
});

// ── GET vendor ────────────────────────────────────────────────────────────────
router.get("/vendors/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, id));
  if (!row) { res.status(404).json({ error: "Vendor not found" }); return; }
  const contacts = await db.select().from(vendorContactsTable).where(eq(vendorContactsTable.vendorId, id));
  res.json(fmtVendor(row, contacts));
});

// ── UPDATE vendor ─────────────────────────────────────────────────────────────
router.patch("/vendors/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { contacts: contactsBody, ...body } = req.body;
  const [row] = await db.update(vendorsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(vendorsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Vendor not found" }); return; }
  const contacts = await db.select().from(vendorContactsTable).where(eq(vendorContactsTable.vendorId, id));
  res.json(fmtVendor(row, contacts));
});

// ── DELETE vendor ─────────────────────────────────────────────────────────────
router.delete("/vendors/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(vendorsTable).where(eq(vendorsTable.id, id));
  res.json({ ok: true });
});

// ── CONTACTS sub-resource ─────────────────────────────────────────────────────
router.post("/vendors/:id/contacts", async (req, res): Promise<void> => {
  const vendorId = Number(req.params.id);
  const [contact] = await db.insert(vendorContactsTable).values({ ...req.body, vendorId }).returning();
  res.status(201).json(contact);
});

router.delete("/vendors/:id/contacts/:cid", async (req, res): Promise<void> => {
  await db.delete(vendorContactsTable).where(eq(vendorContactsTable.id, Number(req.params.cid)));
  res.json({ ok: true });
});

export default router;
