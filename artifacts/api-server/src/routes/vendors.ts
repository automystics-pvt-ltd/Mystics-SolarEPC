import { Router, type IRouter } from "express";
import { db, vendorsTable, vendorContactsTable, procurementPOsTable } from "@workspace/db";
import { eq, desc, ilike, or, and, ne, inArray, gte } from "drizzle-orm";
import { requirePermission, requireAuth } from "../lib/rbac";

const router: IRouter = Router();

// ── Validation ───────────────────────────────────────────────────────────────
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_RE   = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;
const IFSC_RE  = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PIN_RE   = /^[1-9][0-9]{5}$/;
const ACC_RE   = /^\d{9,18}$/;

type FieldErrors = Record<string, string>;

function validateVendorBody(body: Record<string, any>): FieldErrors {
  const err: FieldErrors = {};

  // Required name
  if (!body.name?.trim())
    err.name = "Vendor name is required";
  else if (body.name.trim().length < 2)
    err.name = "Vendor name must be at least 2 characters";

  // GSTIN
  if (body.gstin?.trim()) {
    const g = body.gstin.trim().toUpperCase();
    if (!GSTIN_RE.test(g))
      err.gstin = "Invalid GSTIN — expected format: 27AABCU9603R1ZX (15 chars)";
  }

  // PAN
  if (body.pan?.trim()) {
    const p = body.pan.trim().toUpperCase();
    if (!PAN_RE.test(p))
      err.pan = "Invalid PAN — expected format: AABCU9603R (10 chars)";
  }

  // Primary email
  if (body.primaryEmail?.trim()) {
    if (!EMAIL_RE.test(body.primaryEmail.trim()))
      err.primaryEmail = "Invalid email address";
  }

  // Primary phone
  if (body.primaryPhone?.trim()) {
    const ph = body.primaryPhone.replace(/[\s\-()]/g, "");
    if (!PHONE_RE.test(ph))
      err.primaryPhone = "Enter a valid 10-digit Indian mobile number (starts 6–9)";
  }

  // IFSC
  if (body.bankIfsc?.trim()) {
    const ifsc = body.bankIfsc.trim().toUpperCase();
    if (!IFSC_RE.test(ifsc))
      err.bankIfsc = "Invalid IFSC — expected format: SBIN0001234";
  }

  // Bank account number
  if (body.bankAccountNumber?.trim()) {
    const acc = body.bankAccountNumber.trim().replace(/\s/g, "");
    if (!ACC_RE.test(acc))
      err.bankAccountNumber = "Account number must be 9–18 digits";
  }

  // Pincode
  if (body.billingPincode?.trim()) {
    if (!PIN_RE.test(body.billingPincode.trim()))
      err.billingPincode = "Invalid pincode — must be 6 digits";
  }

  return err;
}

// Explicit whitelist of fields the client is allowed to set/update.
// Anything not in this list is silently dropped — prevents timestamp strings
// or system fields from ever reaching Drizzle's column mappers.
const VENDOR_WRITABLE_FIELDS = new Set([
  "name", "tradeName", "status",
  "gstin", "pan", "gstRegisteredState", "gstStateCode", "isMsme", "msmeNumber",
  "billingAddress", "billingCity", "billingState", "billingPincode", "billingCountry",
  "primaryEmail", "primaryPhone", "website",
  "bankName", "bankBranch", "bankAccountNumber", "bankIfsc", "bankAccountType", "upiId",
  "paymentTerms", "creditLimit", "tags", "notes",
]);

function normaliseBody(body: Record<string, any>) {
  const b: Record<string, any> = {};
  for (const [key, val] of Object.entries(body)) {
    if (VENDOR_WRITABLE_FIELDS.has(key)) b[key] = val;
  }
  if (b.name)           b.name           = String(b.name).trim();
  if (b.tradeName)      b.tradeName      = String(b.tradeName).trim();
  if (b.gstin)          b.gstin          = String(b.gstin).trim().toUpperCase();
  if (b.pan)            b.pan            = String(b.pan).trim().toUpperCase();
  if (b.primaryEmail)   b.primaryEmail   = String(b.primaryEmail).trim().toLowerCase();
  if (b.primaryPhone)   b.primaryPhone   = String(b.primaryPhone).replace(/[\s\-()]/g, "");
  if (b.bankIfsc)       b.bankIfsc       = String(b.bankIfsc).trim().toUpperCase();
  if (b.billingPincode) b.billingPincode = String(b.billingPincode).trim();
  return b;
}

function fmtVendor(
  v: typeof vendorsTable.$inferSelect,
  contacts: typeof vendorContactsTable.$inferSelect[] = []
) {
  const primaryContact = contacts.find(c => c.isPrimary) ?? contacts[0] ?? null;
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
    primaryContactName: primaryContact?.name ?? null,
    primaryContactDesignation: primaryContact?.designation ?? null,
    primaryContactPhone: primaryContact?.phone ?? null,
    primaryContactEmail: primaryContact?.email ?? null,
    contacts,
    createdBy: v.createdBy, updatedBy: v.updatedBy,
    createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString(),
  };
}

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

  // Batch-fetch contacts for all returned vendors in one query
  const ids = rows.map(r => r.id);
  const allContacts = ids.length
    ? await db.select().from(vendorContactsTable).where(inArray(vendorContactsTable.vendorId, ids))
    : [];
  const contactsByVendor = new Map<number, typeof allContacts>();
  for (const c of allContacts) {
    const arr = contactsByVendor.get(c.vendorId) ?? [];
    arr.push(c);
    contactsByVendor.set(c.vendorId, arr);
  }

  res.json(rows.map(r => fmtVendor(r, contactsByVendor.get(r.id) ?? [])));
});

// ── CREATE vendor ─────────────────────────────────────────────────────────────
router.post("/vendors", requirePermission("vendors", "create"), async (req, res): Promise<void> => {
  const { contacts: contactsBody, ...rawBody } = req.body;
  const body = normaliseBody(rawBody);

  // Field-level validation
  const fieldErrors = validateVendorBody(body);

  // Duplicate GSTIN check
  if (body.gstin && !fieldErrors.gstin) {
    const dup = await db.select({ id: vendorsTable.id })
      .from(vendorsTable)
      .where(eq(vendorsTable.gstin, body.gstin))
      .limit(1);
    if (dup.length > 0)
      fieldErrors.gstin = "This GSTIN is already registered under another vendor";
  }

  if (Object.keys(fieldErrors).length > 0) {
    res.status(400).json({ error: "Validation failed", fields: fieldErrors });
    return;
  }

  // Generate code from DB max id (safe across restarts)
  const maxRow = await db.select({ id: vendorsTable.id }).from(vendorsTable).orderBy(desc(vendorsTable.id)).limit(1);
  const nextNum = (maxRow[0]?.id ?? 0) + 1;
  const code = `VND-${String(nextNum).padStart(4, "0")}`;

  try {
    const [row] = await db.insert(vendorsTable).values({ ...body, code } as typeof vendorsTable.$inferInsert).returning();
    let contacts: typeof vendorContactsTable.$inferSelect[] = [];
    if (contactsBody?.length) {
      contacts = await db.insert(vendorContactsTable)
        .values(contactsBody.map((c: any) => ({ ...c, vendorId: row.id })))
        .returning();
    }
    res.status(201).json(fmtVendor(row, contacts));
  } catch (e: any) {
    if (e?.code === "23505" && e?.constraint?.includes("gstin")) {
      res.status(400).json({ error: "Validation failed", fields: { gstin: "This GSTIN is already registered" } });
    } else {
      res.status(500).json({ error: "Failed to create vendor" });
    }
  }
});

// ── GET vendor ────────────────────────────────────────────────────────────────
router.get("/vendors/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid vendor ID" }); return; }
  const [row] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, id));
  if (!row) { res.status(404).json({ error: "Vendor not found" }); return; }
  const contacts = await db.select().from(vendorContactsTable).where(eq(vendorContactsTable.vendorId, id));
  res.json(fmtVendor(row, contacts));
});

// ── UPDATE vendor ─────────────────────────────────────────────────────────────
router.patch("/vendors/:id", requirePermission("vendors", "edit"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid vendor ID" }); return; }

  const { contacts: contactsBody, ...rawBody } = req.body;
  const body = normaliseBody(rawBody);

  // Field-level validation (only validate fields that are present in the patch)
  const fieldErrors = validateVendorBody({ name: "placeholder", ...body });
  // Remove name error if name wasn't sent in this patch
  if (!("name" in rawBody)) delete fieldErrors.name;

  // Duplicate GSTIN check (exclude self)
  if (body.gstin && !fieldErrors.gstin) {
    const dup = await db.select({ id: vendorsTable.id })
      .from(vendorsTable)
      .where(and(eq(vendorsTable.gstin, body.gstin), ne(vendorsTable.id, id)))
      .limit(1);
    if (dup.length > 0)
      fieldErrors.gstin = "This GSTIN is already registered under another vendor";
  }

  if (Object.keys(fieldErrors).length > 0) {
    res.status(400).json({ error: "Validation failed", fields: fieldErrors });
    return;
  }

  try {
    const [row] = await db.update(vendorsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(vendorsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Vendor not found" }); return; }
    const contacts = await db.select().from(vendorContactsTable).where(eq(vendorContactsTable.vendorId, id));
    res.json(fmtVendor(row, contacts));
  } catch (e: any) {
    if (e?.code === "23505" && e?.constraint?.includes("gstin")) {
      res.status(400).json({ error: "Validation failed", fields: { gstin: "This GSTIN is already registered" } });
    } else {
      res.status(500).json({ error: "Failed to update vendor" });
    }
  }
});

// ── DELETE vendor ─────────────────────────────────────────────────────────────
router.delete("/vendors/:id", requirePermission("vendors", "delete"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid vendor ID" }); return; }
  const [row] = await db.select({ id: vendorsTable.id }).from(vendorsTable).where(eq(vendorsTable.id, id));
  if (!row) { res.status(404).json({ error: "Vendor not found" }); return; }
  await db.delete(vendorsTable).where(eq(vendorsTable.id, id));
  res.json({ ok: true });
});

// ── CONTACTS sub-resource ─────────────────────────────────────────────────────
router.post("/vendors/:id/contacts", requirePermission("vendors", "edit"), async (req, res): Promise<void> => {
  const vendorId = Number(req.params.id);
  if (!vendorId) { res.status(400).json({ error: "Invalid vendor ID" }); return; }

  const body = req.body;
  const err: FieldErrors = {};
  if (!body.name?.trim()) err.name = "Contact name is required";
  if (body.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))
    err.email = "Invalid email address";
  if (body.phone?.trim()) {
    const ph = body.phone.replace(/[\s\-()]/g, "");
    if (!/^[6-9]\d{9}$/.test(ph)) err.phone = "Enter a valid 10-digit Indian mobile number";
  }
  if (Object.keys(err).length > 0) {
    res.status(400).json({ error: "Validation failed", fields: err });
    return;
  }

  const vendorExists = await db.select({ id: vendorsTable.id }).from(vendorsTable).where(eq(vendorsTable.id, vendorId)).limit(1);
  if (!vendorExists.length) { res.status(404).json({ error: "Vendor not found" }); return; }

  // Enforce single primary: demote all others before inserting a primary contact
  if (body.isPrimary) {
    await db.update(vendorContactsTable)
      .set({ isPrimary: false })
      .where(eq(vendorContactsTable.vendorId, vendorId));
  }

  const [contact] = await db.insert(vendorContactsTable)
    .values({ ...body, name: body.name.trim(), vendorId })
    .returning();
  res.status(201).json(contact);
});

// Set one contact as the primary; clears isPrimary on all siblings
router.patch("/vendors/:id/contacts/:cid/set-primary", requirePermission("vendors", "edit"), async (req, res): Promise<void> => {
  const vendorId = Number(req.params.id);
  const cid      = Number(req.params.cid);
  if (!vendorId || !cid) { res.status(400).json({ error: "Invalid ID" }); return; }

  // Verify the contact belongs to this vendor
  const [contact] = await db.select()
    .from(vendorContactsTable)
    .where(and(eq(vendorContactsTable.id, cid), eq(vendorContactsTable.vendorId, vendorId)));
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }

  // Demote all, then promote the target
  await db.update(vendorContactsTable)
    .set({ isPrimary: false })
    .where(eq(vendorContactsTable.vendorId, vendorId));
  const [updated] = await db.update(vendorContactsTable)
    .set({ isPrimary: true })
    .where(eq(vendorContactsTable.id, cid))
    .returning();

  res.json(updated);
});

router.delete("/vendors/:id/contacts/:cid", requirePermission("vendors", "delete"), async (req, res): Promise<void> => {
  const cid = Number(req.params.cid);
  if (!cid) { res.status(400).json({ error: "Invalid contact ID" }); return; }
  await db.delete(vendorContactsTable).where(eq(vendorContactsTable.id, cid));
  res.json({ ok: true });
});

// ── VENDOR STATS (spend chart + KPIs) ────────────────────────────────────────
router.get("/vendors/:id/stats", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid vendor ID" }); return; }

  const [vendor] = await db.select({ id: vendorsTable.id, name: vendorsTable.name })
    .from(vendorsTable).where(eq(vendorsTable.id, id)).limit(1);
  if (!vendor) { res.status(404).json({ error: "Vendor not found" }); return; }

  // Fetch all POs for this vendor (by vendorId FK)
  const allPOs = await db.select().from(procurementPOsTable)
    .where(eq(procurementPOsTable.vendorId, id))
    .orderBy(desc(procurementPOsTable.createdAt));

  const n = (v: unknown) => v !== null && v !== undefined ? Number(v) : 0;

  // ── Date range: accept from/to query params; default to YTD ───────────────
  const today = new Date();
  const fromParam = req.query.from as string | undefined;
  const toParam   = req.query.to   as string | undefined;

  // Default from = Jan 1 of current year (YTD), default to = today
  const fromDate = fromParam ? new Date(fromParam + "T00:00:00.000Z") : new Date(today.getFullYear(), 0, 1);
  const toDate   = toParam   ? new Date(toParam   + "T23:59:59.999Z") : today;

  // ── Build month buckets spanning fromDate → toDate ─────────────────────────
  const months: string[] = [];
  const cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  const endMonth = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
  while (cur <= endMonth) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }

  const receivedPOs = allPOs.filter(p => ["FullyReceived", "Closed"].includes(p.status));

  // POs within the selected date range (for chart + period KPIs)
  const rangedPOs = receivedPOs.filter(p => p.createdAt >= fromDate && p.createdAt <= toDate);

  const monthlySpend = months.map(m => ({
    month: m,
    amount: rangedPOs
      .filter(p => p.createdAt.toISOString().startsWith(m))
      .reduce((s, p) => s + n(p.totalAmount), 0),
  }));

  // ── KPIs ───────────────────────────────────────────────────────────────────
  // periodSpend + avgPoValue are scoped to the selected range;
  // poCount is all-time; lastPO is always the most recent.
  const periodSpend = rangedPOs.reduce((s, p) => s + n(p.totalAmount), 0);
  const avgPoValue  = rangedPOs.length > 0 ? periodSpend / rangedPOs.length : 0;
  const poCount     = allPOs.length;
  const lastPO      = allPOs[0];
  const lastPoDate  = lastPO ? lastPO.createdAt.toISOString() : null;
  const lastPoNumber = lastPO?.poNumber ?? null;

  // ytdSpend kept as alias for backward compat (= periodSpend)
  res.json({ monthlySpend, ytdSpend: periodSpend, periodSpend, poCount, avgPoValue, lastPoDate, lastPoNumber });
});

export default router;
