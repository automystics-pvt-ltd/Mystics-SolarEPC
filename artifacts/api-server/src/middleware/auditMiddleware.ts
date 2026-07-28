/**
 * Automatic audit-capture middleware.
 *
 * Mount AFTER requireAuth() so req.actor is always populated.
 * Skips GET requests (too noisy) and explicitly excluded paths.
 * Overrides res.json to capture response body, then fire-and-forgets
 * a writeAuditLog call on response finish.
 */

import type { RequestHandler } from "express";
import {
  writeAuditLog,
  resolveRoute,
  resolveAction,
  shouldSkip,
  extractEntityLabel,
  extractEntityId,
  getClientIP,
  buildDescription,
} from "../lib/auditLogger";

export function auditMiddleware(): RequestHandler {
  return (req, res, next): void => {
    // Only intercept writes
    if (req.method.toUpperCase() === "GET") { next(); return; }

    const path = req.path;
    if (shouldSkip(path)) { next(); return; }

    // Resolve route info; fall back to "unknown" so no write action is ever silently dropped
    const routeInfo = resolveRoute(path) ?? {
      module: "unknown",
      entityType: path.split("/")[1] ?? "unknown",
      entityLabel: path.split("/")[1] ?? "unknown",
    };

    const startMs = Date.now();
    const actor   = (req as any).actor as { userId: number; role: string } | undefined;

    // Override res.json to capture the body before it's sent
    const origJson = res.json.bind(res);
    let capturedBody: unknown;
    res.json = function (body: unknown) {
      capturedBody = body;
      return origJson(body);
    };

    res.on("finish", () => {
      const statusCode = res.statusCode;
      const auditStatus: "success" | "failure" | "error" =
        statusCode >= 500 ? "error" :
        statusCode >= 400 ? "failure" : "success";

      const action      = resolveAction(req.method, path);
      const entityId    = extractEntityId(path, capturedBody);
      const entityLabel = extractEntityLabel(capturedBody);
      const description = buildDescription(
        action, routeInfo.entityType, entityLabel, routeInfo.entityLabel,
      );
      const ua = req.headers["user-agent"] ?? "";

      // Capture response as new_values (capped at 8 KB, skipped for deletes)
      let newValues: unknown;
      if (auditStatus === "success" && req.method.toUpperCase() !== "DELETE" && capturedBody != null) {
        try {
          newValues = JSON.stringify(capturedBody).length <= 8192 ? capturedBody : { _truncated: true };
        } catch { /* ignore */ }
      }

      const errorMsg =
        auditStatus !== "success" && capturedBody != null && typeof capturedBody === "object"
          ? (capturedBody as Record<string, unknown>).error?.toString()
          : undefined;

      // Fire and forget — never block the response
      void writeAuditLog({
        userId:       actor?.userId,
        userRole:     actor?.role,
        action,
        module:       routeInfo.module,
        entityType:   routeInfo.entityType,
        entityId,
        entityLabel,
        description,
        newValues,
        ipAddress:    getClientIP(req),
        userAgent:    ua,
        status:       auditStatus,
        errorMessage: errorMsg,
        durationMs:   Date.now() - startMs,
      });
    });

    next();
  };
}
