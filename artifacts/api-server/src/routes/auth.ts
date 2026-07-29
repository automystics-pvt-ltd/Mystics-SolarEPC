import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import jwt from "jsonwebtoken";
import { writeAuditLog, getClientIP } from "../lib/auditLogger";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

const JWT_SECRET = process.env.SESSION_SECRET ?? "mystics-erp-secret";

router.post("/auth/login", async (req, res): Promise<void> => {
  const ip = getClientIP(req);
  const ua = req.headers["user-agent"] ?? "";

  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));

  // Support both plaintext passwords (legacy seed accounts) and bcrypt hashes
  // (super_admin and any future properly-hashed accounts). Bcrypt hashes always
  // start with "$2" — if the stored hash doesn't match that prefix, fall back
  // to the legacy direct comparison used by all existing seed users.
  const isBcrypt = user?.passwordHash?.startsWith("$2");
  const passwordValid = user && (
    isBcrypt
      ? await bcrypt.compare(parsed.data.password, user.passwordHash)
      : user.passwordHash === parsed.data.password
  );

  if (!passwordValid) {
    // Audit failed login (fire-and-forget)
    void writeAuditLog({
      action:       "login",
      module:       "auth",
      entityType:   "user",
      entityLabel:  parsed.data.email,
      description:  `Failed login attempt for ${parsed.data.email}`,
      ipAddress:    ip,
      userAgent:    ua,
      status:       "failure",
      errorMessage: "Invalid email or password",
    });
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

  // Audit successful login (fire-and-forget)
  void writeAuditLog({
    userId:      user.id,
    userName:    user.name,
    userRole:    user.role,
    action:      "login",
    module:      "auth",
    entityType:  "user",
    entityId:    String(user.id),
    entityLabel: user.name,
    description: `${user.name} logged in`,
    ipAddress:   ip,
    userAgent:   ua,
    status:      "success",
  });

  res.json({
    token,
    user: {
      id:    user.id,
      name:  user.name,
      email: user.email,
      role:  user.role,
      orgId: user.orgId,
    },
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  let decoded: { userId: number; role: string };
  try {
    decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, decoded.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id:    user.id,
    name:  user.name,
    email: user.email,
    role:  user.role,
    orgId: user.orgId,
  });
});

export default router;
