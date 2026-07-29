/**
 * Lightweight API helpers that share auth-aware fetch logic.
 * Use these for endpoints not yet in the OpenAPI spec.
 */

type FetchOptions = RequestInit & {
  responseType?: 'json' | 'text' | 'blob' | 'auto';
};

const NO_BODY_STATUS = new Set([204, 205, 304]);

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly data: unknown,
  ) {
    super(`API error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

/** Reads the JWT from localStorage and injects it as a Bearer token. */
function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('mystics_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...getAuthHeaders(),
    ...(options.headers as Record<string, string> | undefined),
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = await response.text().catch(() => null);
    }
    throw new ApiError(response.status, response.statusText, data);
  }

  if (NO_BODY_STATUS.has(response.status)) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

export function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  options?: RequestInit,
): Promise<T> {
  let url = `/api${path}`;
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }
  return apiFetch<T>(url, options);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(`/api${path}`, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(`/api${path}`, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(`/api${path}`, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(`/api${path}`, {
    method: 'DELETE',
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
