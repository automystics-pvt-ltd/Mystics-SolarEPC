/**
 * Typed, validated environment configuration.
 * Import { env } wherever you need environment constants.
 * Add new variables here — never import.meta.env directly in app code.
 */
export const env = {
  /** 'development' | 'production' | 'test' */
  mode: import.meta.env.MODE as 'development' | 'production' | 'test',

  /** true in development (Vite HMR active) */
  isDev: import.meta.env.DEV,

  /** true in production build */
  isProd: import.meta.env.PROD,

  /**
   * Base path used by WouterRouter to strip the proxy prefix before matching routes.
   * Set via VITE_ROUTER_BASE env var (see .env). Kept separate from Vite's BASE_URL
   * so asset paths through the Replit proxy are unaffected.
   */
  basePath: (import.meta.env.VITE_ROUTER_BASE ?? import.meta.env.BASE_URL ?? '/').replace(/\/$/, ''),

  /** API base URL — always relative so it works behind the Replit proxy */
  apiBase: '/api',

  /** Application version from package.json (injected by Vite define) */
  version: (import.meta.env.VITE_APP_VERSION ?? '2.4.0') as string,

  /** App name */
  appName: 'Solar EPC',

  /** Company name */
  company: 'Automystics Technologies',
} as const;
