/**
 * Lightweight API helpers that re-use the same customFetch (with auth token)
 * as the Orval-generated client. Use these for endpoints not yet in the
 * OpenAPI spec.
 */
import { customFetch } from "@workspace/api-client-react";

export function apiGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  let url = `/api${path}`;
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (qs) url += `?${qs}`;
  }
  return customFetch<T>(url);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return customFetch<T>(`/api${path}`, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return customFetch<T>(`/api${path}`, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T>(path: string): Promise<T> {
  return customFetch<T>(`/api${path}`, { method: "DELETE" });
}
