import { defineConfig } from "@playwright/test";
import { execSync } from "child_process";

/**
 * Playwright config for mobile-viewport E2E smoke tests.
 * Targets the local ERP dev server at port 18996.
 *
 * Run:  pnpm --filter @workspace/erp test:e2e
 *
 * NOTE: This config lives inside the e2e/ subfolder so that Playwright's
 * tsconfig scanner finds e2e/tsconfig.json (no project references) before
 * it ever reaches artifacts/erp/tsconfig.json (which has bare directory
 * references that Playwright 1.62 cannot resolve).
 *
 * CHROMIUM RESOLUTION
 * -------------------
 * Priority order:
 *   1. PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH env var (override for CI or custom setups)
 *   2. `which chromium` — resolves the Nix-profile symlink that Nix keeps stable
 *      across derivation rebuilds (the /nix/store/… path changes but the
 *      profile symlink at /run/current-system/sw/bin/chromium does not).
 *   3. `which chromium-browser` — fallback binary name on some Linux distros.
 * Failing to resolve any of these throws at startup so the error is obvious.
 */
function resolveChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  for (const bin of ["chromium", "chromium-browser", "google-chrome"]) {
    try {
      return execSync(`which ${bin}`, { encoding: "utf8" }).trim();
    } catch { /* try next */ }
  }
  throw new Error(
    "No Chromium binary found. Install the `chromium` Nix package or set " +
    "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to the desired binary path."
  );
}

const chromiumExecutable = resolveChromium();

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "../playwright-report" }]],
  timeout: 60_000,

  use: {
    // Route through the Replit proxy at port 80.  That proxy maps "/" → ERP
    // (port 18996) and "/api/*" → the API server (port 8080), so in-browser
    // API calls (relative paths like /api/leads) reach the real API server.
    // Connecting directly to port 18996 would serve index.html for every
    // /api/* path (Vite SPA fallback) and break all data-dependent tests.
    baseURL: "http://localhost:80",
    /* iPhone 14 viewport */
    viewport: { width: 390, height: 844 },
    /* Emulate a real mobile user-agent so media queries fire correctly */
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    /* Keep screenshots on failure for debugging */
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    /* Tell the browser this is a touch device */
    hasTouch: true,
    isMobile: true,
  },

  projects: [
    {
      name: "mobile-chrome",
      use: {
        /* Use system Chromium resolved from PATH (see resolveChromium above).
         * The Playwright-downloaded chromium-headless-shell fails on missing
         * system libs in the Replit sandbox; the Nix chromium package is
         * already linked against the correct Nix store paths.              */
        browserName: "chromium",
        channel: undefined,
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 3,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        launchOptions: {
          executablePath: chromiumExecutable,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        },
      },
    },
  ],

  /* Do NOT spin up a dev server here — tests rely on the already-running
   * workflow (`artifacts/erp: web`).  If the server isn't up the tests
   * will fail with a clear connection-refused message. */
});
