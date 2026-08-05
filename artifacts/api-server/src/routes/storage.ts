import { Readable } from "stream";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  ObjectNotFoundError,
  ObjectStorageService,
  STORAGE_BACKEND,
} from "../lib/objectStorage";
import jwt from "jsonwebtoken";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const JWT_SECRET = process.env.SESSION_SECRET ?? "mystics-erp-secret";

function isAuthenticated(req: Request): boolean {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return false;
  try { jwt.verify(h.slice(7), JWT_SECRET); return true; } catch { return false; }
}

/**
 * POST /storage/uploads/request-url
 * Returns a URL for the client to PUT the file to.
 * In Replit mode: returns a GCS presigned URL (client PUTs directly to GCS).
 * In local mode: returns a /api/storage/uploads/direct/<uuid> API endpoint URL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { name, size, contentType } = req.body ?? {};
  if (!name) {
    res.status(400).json({ error: "Missing required field: name" });
    return;
  }
  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * PUT /storage/uploads/direct/:uuid
 * LOCAL STORAGE ONLY — receives the raw file body directly from the client
 * (mirrors what GCS presigned PUT does, but stored to local disk).
 * Content-Type header is preserved. Returns 200 on success.
 */
router.put("/storage/uploads/direct/:uuid", async (req: Request, res: Response) => {
  if (STORAGE_BACKEND !== 'local') {
    res.status(404).json({ error: "Direct upload endpoint is only available in local storage mode." });
    return;
  }
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const uuid = Array.isArray(req.params.uuid) ? req.params.uuid[0]! : req.params.uuid!;
  if (!uuid || !/^[0-9a-f-]{36}$/i.test(uuid)) {
    res.status(400).json({ error: "Invalid upload token" });
    return;
  }
  const contentType = (req.headers["content-type"] as string) ?? "application/octet-stream";

  try {
    // Collect raw body into a Buffer
    const chunks: Buffer[] = [];
    for await (const chunk of req as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const data = Buffer.concat(chunks);
    objectStorageService.writeLocalUpload(uuid, data, contentType);
    res.status(200).json({ ok: true });
  } catch (error) {
    req.log.error({ err: error }, "Error saving local upload");
    res.status(500).json({ error: "Failed to save uploaded file" });
  }
});

/**
 * GET /storage/public-objects/*
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS (Replit) or local dir (VPS).
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) { res.status(404).json({ error: "File not found" }); return; }
    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else { res.end(); }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 * Serve private object entities (JWT required).
 * Works for both GCS objects (Replit) and local files (VPS).
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  if (!isAuthenticated(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else { res.end(); }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" }); return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
