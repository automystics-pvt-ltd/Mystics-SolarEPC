/**
 * Application-wide UI zoom — works like browser zoom but scoped to the app.
 *
 * Strategy: apply CSS `zoom` to <html> so every DOM node (including Radix
 * UI portals appended to <body>) is scaled proportionally, just like the
 * browser's own zoom feature.
 *
 * Persistence:
 *   • Generic key "mystics_ui_zoom" → applied immediately on cold load
 *     (mirrored by the inline script in index.html to prevent flash)
 *   • Per-user key "mystics_ui_zoom_<id>" → applied when auth resolves
 */
import {
  createContext, useContext, useEffect, useRef, useState, type ReactNode,
} from "react";
import { useAuth } from "./auth";

/* ── Constants ───────────────────────────────────────────────── */
export const ZOOM_LEVELS = [0.8, 0.9, 1.0, 1.1, 1.25, 1.5] as const;
export type ZoomLevel = typeof ZOOM_LEVELS[number];

export const ZOOM_LABELS: Record<ZoomLevel, string> = {
  0.8: "80%", 0.9: "90%", 1.0: "100%", 1.1: "110%", 1.25: "125%", 1.5: "150%",
};

const GENERIC_KEY = "mystics_ui_zoom";
const userKey = (id: number) => `mystics_ui_zoom_${id}`;

/* ── Helpers ─────────────────────────────────────────────────── */
function clampToLevel(raw: unknown): ZoomLevel {
  const n = Number(raw);
  return (ZOOM_LEVELS as readonly number[]).includes(n)
    ? (n as ZoomLevel)
    : 1.0;
}

function readStored(userId?: number): ZoomLevel {
  try {
    if (userId) {
      const v = localStorage.getItem(userKey(userId));
      if (v) return clampToLevel(v);
    }
    const v = localStorage.getItem(GENERIC_KEY);
    if (v) return clampToLevel(v);
  } catch { /* localStorage unavailable */ }
  return 1.0;
}

/** Writes zoom directly to <html> style — intentionally side-effectful. */
function applyZoomToDOM(level: ZoomLevel) {
  if (level === 1.0) {
    document.documentElement.style.removeProperty("zoom");
  } else {
    document.documentElement.style.zoom = String(level);
  }
}

/* ── Context ─────────────────────────────────────────────────── */
interface ZoomCtx {
  zoom: ZoomLevel;
  zoomLabel: string;
  setZoom: (level: ZoomLevel) => void;
  increase: () => void;
  decrease: () => void;
  reset: () => void;
  canIncrease: boolean;
  canDecrease: boolean;
}

const ZoomContext = createContext<ZoomCtx | null>(null);

/* ── Provider ────────────────────────────────────────────────── */
export function ZoomProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Initialise from generic key; user-specific override applied below.
  const [zoom, setZoomState] = useState<ZoomLevel>(() => readStored());

  // When user identity resolves, apply their stored preference.
  useEffect(() => {
    if (!user?.id) return;
    const saved = readStored(user.id);
    if (saved !== zoom) {
      setZoomState(saved);
      applyZoomToDOM(saved);
    }
    // eslint-disable-next-line
  }, [user?.id]);

  /* Canonical setter — updates state, DOM, and storage atomically */
  const setZoom = (level: ZoomLevel) => {
    setZoomState(level);
    applyZoomToDOM(level);
    try {
      localStorage.setItem(GENERIC_KEY, String(level));
      if (user?.id) localStorage.setItem(userKey(user.id), String(level));
    } catch { /* ignore */ }
  };

  const idx = ZOOM_LEVELS.indexOf(zoom);
  const canIncrease = idx < ZOOM_LEVELS.length - 1;
  const canDecrease = idx > 0;
  const increase = () => { if (canIncrease) setZoom(ZOOM_LEVELS[idx + 1]); };
  const decrease = () => { if (canDecrease) setZoom(ZOOM_LEVELS[idx - 1]); };
  const reset    = () => setZoom(1.0);

  /* Keyboard shortcuts (Ctrl+= zoom in, Ctrl+- zoom out, Ctrl+0 reset)
     Uses a ref so the handler never goes stale without re-registering. */
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.shiftKey) return; // don't steal Ctrl+Shift+…

      const cur = zoomRef.current;
      const i   = ZOOM_LEVELS.indexOf(cur);

      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        if (i < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[i + 1]);
      } else if (e.key === "-") {
        e.preventDefault();
        if (i > 0) setZoom(ZOOM_LEVELS[i - 1]);
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(1.0);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  // eslint-disable-next-line
  }, []); // stable — reads zoom through ref

  return (
    <ZoomContext.Provider value={{
      zoom, zoomLabel: ZOOM_LABELS[zoom],
      setZoom, increase, decrease, reset,
      canIncrease, canDecrease,
    }}>
      {children}
    </ZoomContext.Provider>
  );
}

/* ── Hook ────────────────────────────────────────────────────── */
export function useZoom(): ZoomCtx {
  const ctx = useContext(ZoomContext);
  if (!ctx) throw new Error("useZoom must be used inside <ZoomProvider>");
  return ctx;
}
