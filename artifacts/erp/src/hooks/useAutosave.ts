import { useEffect, useCallback, useRef } from "react";

interface UseAutosaveOptions<T> {
  /** Unique key for this draft in localStorage */
  key: string;
  /** Current form values to save */
  data: T;
  /** Interval in ms between saves (default: 10 000) */
  interval?: number;
  /** Whether autosave is active (default: true) */
  enabled?: boolean;
}

/**
 * Autosaves form data to localStorage on a timer.
 * Returns `{ restore, clear }` to load or delete the saved draft.
 */
export function useAutosave<T>({ key, data, interval = 10_000, enabled = true }: UseAutosaveOptions<T>) {
  const storageKey = `autosave:${key}`;
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ data: dataRef.current, ts: Date.now() }));
      } catch {}
    }, interval);
    return () => clearInterval(timer);
  }, [storageKey, interval, enabled]);

  const restore = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const { data } = JSON.parse(raw);
      return data ?? null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  const hasDraft = useCallback((): boolean => {
    return !!localStorage.getItem(storageKey);
  }, [storageKey]);

  const draftAge = useCallback((): string | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const { ts } = JSON.parse(raw);
      const ago = Math.round((Date.now() - ts) / 60000);
      if (ago < 1) return "just now";
      if (ago === 1) return "1 minute ago";
      if (ago < 60) return `${ago} minutes ago`;
      return `${Math.round(ago / 60)} hours ago`;
    } catch {
      return null;
    }
  }, [storageKey]);

  return { restore, clear, hasDraft, draftAge };
}
