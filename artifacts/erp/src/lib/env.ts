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

  /** Base path of the ERP app e.g. '/erp' */
  basePath: (import.meta.env.BASE_URL ?? '/').replace(/\/$/, ''),

  /** API base URL — always relative so it works behind the Replit proxy */
  apiBase: '/api',

  /** Application version from package.json (injected by Vite define) */
  version: (import.meta.env.VITE_APP_VERSION ?? '2.4.0') as string,

  /** App name */
  appName: 'Mystics ERP',

  /** Company name */
  company: 'Automystics Technologies',
} as const;
