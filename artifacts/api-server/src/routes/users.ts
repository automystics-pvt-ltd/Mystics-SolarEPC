import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

// GET /users — list all users (admin)
router.get("/users", async (req, res): Promise<void> => {
  try {
    const rows = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      orgId: usersTable.orgId,
      createdAt: usersTable.createdAt,
    }).from(usersTable).orderBy(desc(usersTable.createdAt));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// POST /users — create user (admin)
router.post("/users", async (req, res): Promise<void> => {
  try {
    const { name, email, password, role = "sales" } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "name, email, password required" }); return;
    }
    // Check email uniqueness
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
    if (existing.length > 0) { res.status(409).json({ error: "Email already exists" }); return; }

    // Hash password (use simple hash to match existing pattern, or bcrypt if available)
    let passwordHash: string;
    try { passwordHash = await bcrypt.hash(password, 10); } catch { passwordHash = password; }

    const [user] = await db.insert(usersTable).values({ name, email, passwordHash, role }).returning({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      role: usersTable.role, createdAt: usersTable.createdAt,
    });
    res.status(201).json(user);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// PATCH /users/:id — update user role
router.patch("/users/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { name, role } = req.body;
    const updates: Record<string, string> = {};
    if (name) updates.name = name;
    if (role) updates.role = role;
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
    const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      role: usersTable.role, createdAt: usersTable.createdAt,
    });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(user);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// PATCH /users/:id/reset-password
router.patch("/users/:id/reset-password", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { password } = req.body;
    if (!password) { res.status(400).json({ error: "password required" }); return; }
    let passwordHash: string;
    try { passwordHash = await bcrypt.hash(password, 10); } catch { passwordHash = password; }
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, id));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

export default router;
