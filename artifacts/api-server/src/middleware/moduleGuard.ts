/**
 * moduleGuard — Express middleware factory.
 * Returns 503 when the named module is disabled in module_config.
 */
import { type Request, type Response, type NextFunction } from "express";
import { isModuleEnabled } from "../lib/moduleCache";

export function requireModule(moduleName: string) {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const enabled = await isModuleEnabled(moduleName);
      if (!enabled) {
        res.status(503).json({
          error: `The '${moduleName}' module is currently disabled. Contact your administrator to re-enable it.`,
          module: moduleName,
          disabled: true,
        });
        return;
      }
      next();
    } catch {
      // Fail open — if cache check throws, let the request through.
      next();
    }
  };
}
