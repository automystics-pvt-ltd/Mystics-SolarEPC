/**
 * Playwright global setup — runs ONCE before the entire test suite.
 *
 * Logs in as admin, injects the JWT + user-cache into localStorage, then
 * saves the full browser storage state to `.auth/state.json`.  Every test
 * project that sets `storageState: ".auth/state.json"` in playwright.config
 * will start with a pre-authenticated context, skipping the per-test login
 * round-trip that used to cost ~20 s per test.
 */

import { chromium, type FullConfig } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Playwright esbuild transpiles TypeScript to ESM, so __dirname is not
// available. Derive it from import.meta.url which IS available in ESM.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — import.meta is valid in ESM at runtime even though tsconfig says CommonJS
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveChromium(): string {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  for (const bin of ["chromium", "chromium-browser", "google-chrome"]) {
    try {
      return execSync(`which ${bin}`, { encoding: "utf8" }).trim();
    } catch {
      /* try next */
    }
  }
  throw new Error(
    "No Chromium binary found. Install the `chromium` Nix package or set " +
      "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to the desired binary path.",
  );
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  // The playwright.config.mjs `storageState: ".auth/state.json"` is resolved
  // relative to CWD (artifacts/erp) by Playwright at runtime, so we save here
  // too.  __dirname points to e2e/ but the config reads from the project root.
  const authFile = path.join(process.cwd(), ".auth", "state.json");
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  const browser = await chromium.launch({
    executablePath: resolveChromium(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const context = await browser.newContext({
    baseURL: "http://localhost:80",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  // Load root so the JS bundle initialises and localStorage becomes available.
  await page.goto("http://localhost:80/", { waitUntil: "domcontentloaded" });

  // Authenticate against the API server directly (bypasses the Vite proxy).
  const resp = await page.request.post(
    "http://localhost:8080/api/auth/login",
    {
      data: { email: "admin@automystics.com", password: "admin123" },
      headers: { "Content-Type": "application/json" },
    },
  );

  if (!resp.ok()) {
    await browser.close();
    throw new Error(
      `Global setup: login failed ${resp.status()}: ${await resp.text()}`,
    );
  }

  const { token, user } = (await resp.json()) as {
    token: string;
    user: Record<string, unknown>;
  };

  // Inject the token and user cache so React skips the /api/auth/me round-trip.
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem("mystics_token", token);
      localStorage.setItem(
        "mystics_user_v2",
        JSON.stringify({ user, ts: Date.now() }),
      );
    },
    { token, user },
  );

  // Persist the full storage state (localStorage + sessionStorage + cookies).
  await context.storageState({ path: authFile });
  await browser.close();

  console.log("[global-setup] Auth state saved →", authFile);
}
