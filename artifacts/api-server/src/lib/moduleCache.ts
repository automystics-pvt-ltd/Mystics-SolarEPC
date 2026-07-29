/**
 * moduleCache — reads module_config.enabled with a 60-second in-process cache.
 * Fail-open: if the DB is unreachable, every module is treated as enabled.
 */
import pg from "pg";

const CACHE_TTL_MS = 60_000;

let cachedModules: Map<string, boolean> = new Map();
let lastFetch = 0;

async function fetchAllFromDB(): Promise<Map<string, boolean>> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ module: string; enabled: boolean }>(
      "SELECT module, enabled FROM module_config"
    );
    const result = new Map<string, boolean>();
    for (const row of rows) result.set(row.module, row.enabled);
    return result;
  } finally {
    await client.end().catch(() => {});
  }
}

async function refreshIfStale(): Promise<void> {
  if (Date.now() - lastFetch < CACHE_TTL_MS) return;
  try {
    cachedModules = await fetchAllFromDB();
    lastFetch = Date.now();
  } catch {
    // Keep the stale cache (or empty map) — fail open.
  }
}

/** Returns true when the module is enabled (or unknown — fail open). */
export async function isModuleEnabled(moduleName: string): Promise<boolean> {
  await refreshIfStale();
  return cachedModules.get(moduleName) ?? true;
}

/** Returns all module statuses as a plain object. */
export async function getAllModuleStatuses(): Promise<Record<string, boolean>> {
  await refreshIfStale();
  return Object.fromEntries(cachedModules);
}

/** Force-invalidate the cache — call after any PUT /platform-admin/modules. */
export function invalidateModuleCache(): void {
  lastFetch = 0;
}
