import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests for production. Hits the live deploy and verifies the
 * pages real users see actually render. Not a replacement for unit
 * tests — purely a "did we break the public site" canary.
 *
 * Run locally: `npx playwright test`
 * Override target: `PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test`
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // Smoke tests are read-only against prod; running them in parallel is safe.
  fullyParallel: true,
  // Fail fast on CI to keep the loop tight.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ||
      "https://romero-photography.vercel.app",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
  ],
});
