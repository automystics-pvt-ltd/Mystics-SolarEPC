import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import {
  existsSync, mkdirSync, createReadStream, statSync,
  writeFileSync, unlinkSync, readFileSync,
} from 'fs';
import { join, resolve } from 'path';
import { File, Storage } from '@google-cloud/storage';

import {
  canAccessObject,
  getObjectAclPolicy,
  ObjectAclPolicy,
  ObjectPermission,
  setObjectAclPolicy,
} from './objectAcl';

/* ─────────────────────────────────────────────────────────────────────────────
 * Storage backend detection
 * STORAGE_BACKEND=local  → local-disk mode (VPS)
 * STORAGE_BACKEND=replit → Replit GCS sidecar (default in Replit workspace)
 * When unset, falls back to "local" on non-Replit environments.
 * ───────────────────────────────────────────────────────────────────────────── */
export const STORAGE_BACKEND: 'replit' | 'local' = (() => {
  const explicit = process.env.STORAGE_BACKEND;
  if (explicit === 'local')  return 'local';
  if (explicit === 'replit') return 'replit';
  // Auto-detect: if the Replit workspace env var is present, use Replit GCS.
  return process.env.REPL_ID ? 'replit' : 'local';
})();

/* ─────────────────────────────────────────────────────────────────────────────
 * Replit GCS sidecar client  (only used when STORAGE_BACKEND === 'replit')
 * ───────────────────────────────────────────────────────────────────────────── */
const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

export const objectStorageClient = new Storage({
  credentials: {
    audience: 'replit',
    subject_token_type: 'access_token',
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: 'external_account',
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: 'json',
        subject_token_field_name: 'access_token',
      },
    },
    universe_domain: 'googleapis.com',
  },
  projectId: '',
});

/* ─────────────────────────────────────────────────────────────────────────────
 * LocalFileHandle — a lightweight wrapper that mirrors the GCS File interface
 * just enough for ObjectStorageService.downloadObject() to handle both.
 * ───────────────────────────────────────────────────────────────────────────── */
export class LocalFileHandle {
  constructor(
    public readonly absolutePath: string,
    public readonly storedContentType: string = 'application/octet-stream',
  ) {}

  createReadStream(): Readable {
    return createReadStream(this.absolutePath);
  }

  async getMetadata(): Promise<[{ contentType: string; size: number }]> {
    const stat = statSync(this.absolutePath);
    return [{ contentType: this.storedContentType, size: stat.size }];
  }

  async exists(): Promise<[boolean]> {
    return [existsSync(this.absolutePath)];
  }
}

/* The union type returned by getObjectEntityFile / searchPublicObject */
export type StorageFileHandle = File | LocalFileHandle;

/* ─────────────────────────────────────────────────────────────────────────────
 * Errors
 * ───────────────────────────────────────────────────────────────────────────── */
export class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────────────────────── */
function getLocalUploadDir(): string {
  const dir = process.env.LOCAL_UPLOAD_DIR ?? resolve(process.cwd(), 'data', 'uploads');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function getLocalApiBaseUrl(): string {
  return (process.env.PUBLIC_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith('/')) path = `/${path}`;
  const parts = path.split('/');
  if (parts.length < 3) throw new Error('Invalid path: must contain at least a bucket name');
  return { bucketName: parts[1]!, objectName: parts.slice(2).join('/') };
}

async function signObjectURL({
  bucketName, objectName, method, ttlSec,
}: {
  bucketName: string; objectName: string;
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD'; ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}. ` +
      `This server uses STORAGE_BACKEND=replit but the Replit sidecar is not available.`,
    );
  }
  const { signed_url: signedURL } = (await response.json()) as { signed_url: string };
  return signedURL;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ObjectStorageService
 * Dual-mode: switches between Replit GCS sidecar and local-disk storage.
 * ───────────────────────────────────────────────────────────────────────────── */
export class ObjectStorageService {
  constructor() {}

  /* ── GCS-only config helpers ──────────────────────────────────────────────── */
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || '';
    const paths = Array.from(
      new Set(pathsStr.split(',').map(p => p.trim()).filter(p => p.length > 0)),
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Set this env var for public object access.",
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || '';
    if (!dir) {
      throw new Error("PRIVATE_OBJECT_DIR not set.");
    }
    return dir;
  }

  /* ── searchPublicObject ───────────────────────────────────────────────────── */
  async searchPublicObject(filePath: string): Promise<StorageFileHandle | null> {
    if (STORAGE_BACKEND === 'local') {
      const uploadDir = getLocalUploadDir();
      const candidate = join(uploadDir, filePath);
      if (existsSync(candidate)) {
        const metaPath = `${candidate}.meta`;
        const contentType = existsSync(metaPath)
          ? (JSON.parse(readFileSync(metaPath, 'utf8')) as { contentType?: string }).contentType ?? 'application/octet-stream'
          : 'application/octet-stream';
        return new LocalFileHandle(candidate, contentType);
      }
      return null;
    }

    // Replit GCS
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (exists) return file;
    }
    return null;
  }

  /* ── downloadObject ───────────────────────────────────────────────────────── */
  async downloadObject(
    file: StorageFileHandle,
    cacheTtlSec: number = 3600,
  ): Promise<Response> {
    // Local disk path
    if (file instanceof LocalFileHandle) {
      const [meta] = await file.getMetadata();
      const stream = file.createReadStream();
      const webStream = Readable.toWeb(stream) as ReadableStream;
      return new Response(webStream, {
        headers: {
          'Content-Type': meta.contentType,
          'Content-Length': String(meta.size),
          'Cache-Control': `private, max-age=${cacheTtlSec}`,
        },
      });
    }

    // Replit GCS
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === 'public';
    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;
    const headers: Record<string, string> = {
      'Content-Type': (metadata.contentType as string) || 'application/octet-stream',
      'Cache-Control': `${isPublic ? 'public' : 'private'}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) headers['Content-Length'] = String(metadata.size);
    return new Response(webStream, { headers });
  }

  /* ── getObjectEntityUploadURL ─────────────────────────────────────────────── */
  async getObjectEntityUploadURL(): Promise<string> {
    if (STORAGE_BACKEND === 'local') {
      const uuid = randomUUID();
      // Return an API endpoint URL; the route handler in storage.ts stores the body.
      return `${getLocalApiBaseUrl()}/api/storage/uploads/direct/${uuid}`;
    }

    // Replit GCS
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    return signObjectURL({ bucketName, objectName, method: 'PUT', ttlSec: 900 });
  }

  /* ── getObjectEntityFile ──────────────────────────────────────────────────── */
  async getObjectEntityFile(objectPath: string): Promise<StorageFileHandle> {
    if (!objectPath.startsWith('/objects/')) throw new ObjectNotFoundError();

    // Local mode: /objects/local-uploads/<uuid>
    if (STORAGE_BACKEND === 'local') {
      const prefix = '/objects/local-uploads/';
      if (!objectPath.startsWith(prefix)) throw new ObjectNotFoundError();
      const uuid = objectPath.slice(prefix.length);
      const uploadDir = getLocalUploadDir();
      const filePath = join(uploadDir, uuid);
      if (!existsSync(filePath)) throw new ObjectNotFoundError();
      const metaPath = `${filePath}.meta`;
      const contentType = existsSync(metaPath)
        ? (JSON.parse(readFileSync(metaPath, 'utf8')) as { contentType?: string }).contentType ?? 'application/octet-stream'
        : 'application/octet-stream';
      return new LocalFileHandle(filePath, contentType);
    }

    // Replit GCS
    const parts = objectPath.slice(1).split('/');
    if (parts.length < 2) throw new ObjectNotFoundError();
    const entityId = parts.slice(1).join('/');
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith('/')) entityDir = `${entityDir}/`;
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) throw new ObjectNotFoundError();
    return objectFile;
  }

  /* ── normalizeObjectEntityPath ────────────────────────────────────────────── */
  normalizeObjectEntityPath(rawPath: string): string {
    // Local mode: URL pattern is <baseUrl>/api/storage/uploads/direct/<uuid>
    if (STORAGE_BACKEND === 'local') {
      const marker = '/api/storage/uploads/direct/';
      const idx = rawPath.indexOf(marker);
      if (idx !== -1) {
        const uuid = rawPath.slice(idx + marker.length).split('?')[0]!;
        return `/objects/local-uploads/${uuid}`;
      }
      return rawPath;
    }

    // Replit GCS: raw path is a GCS signed URL
    if (!rawPath.startsWith('https://storage.googleapis.com/')) return rawPath;
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.startsWith('/')) objectEntityDir = `/${objectEntityDir}`;
    if (!objectEntityDir.endsWith('/'))  objectEntityDir = `${objectEntityDir}/`;
    if (!rawObjectPath.startsWith(objectEntityDir)) return rawObjectPath;
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  /* ── trySetObjectEntityAclPolicy ──────────────────────────────────────────── */
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith('/')) return normalizedPath;
    // ACL policies only apply to GCS objects
    if (STORAGE_BACKEND === 'local') return normalizedPath;
    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile as File, aclPolicy);
    return normalizedPath;
  }

  /* ── canAccessObjectEntity ────────────────────────────────────────────────── */
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: StorageFileHandle;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    // Local storage: no ACL — all authenticated users can access
    if (objectFile instanceof LocalFileHandle) return true;
    return canAccessObject({
      userId,
      objectFile: objectFile as File,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }

  /* ── deleteObject (local) ─────────────────────────────────────────────────── */
  async deleteObject(objectPath: string): Promise<void> {
    if (STORAGE_BACKEND === 'local') {
      const prefix = '/objects/local-uploads/';
      if (!objectPath.startsWith(prefix)) return;
      const uuid = objectPath.slice(prefix.length);
      const uploadDir = getLocalUploadDir();
      const filePath = join(uploadDir, uuid);
      if (existsSync(filePath))  unlinkSync(filePath);
      const metaPath = `${filePath}.meta`;
      if (existsSync(metaPath)) unlinkSync(metaPath);
      return;
    }
    // GCS deletion not implemented (files expire via GCS lifecycle rules)
  }

  /* ── writeLocalUpload (called by storage route in local mode) ─────────────── */
  writeLocalUpload(uuid: string, data: Buffer, contentType: string): string {
    const uploadDir = getLocalUploadDir();
    const filePath = join(uploadDir, uuid);
    writeFileSync(filePath, data);
    writeFileSync(`${filePath}.meta`, JSON.stringify({ contentType }));
    return `/objects/local-uploads/${uuid}`;
  }
}
