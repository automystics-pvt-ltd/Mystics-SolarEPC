import type { ElementType } from "react";

/**
 * Flat lookup populated by NavRail at module init time.
 * Kept in its own file so NavRail.tsx only exports React components,
 * enabling Vite Fast Refresh on the nav rail.
 */
export const HREF_META: Record<string, { name: string; section: string; icon: ElementType }> = {};
