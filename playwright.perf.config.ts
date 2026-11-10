import { defineConfig, devices } from "@playwright/test";

/** Task 17.14: runs e2e/map-timing.spec.ts against an already running production server (PERF_BASE_URL). No webServer. */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "map-timing.spec.ts",
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.PERF_BASE_URL ?? "http://localhost:3300" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
