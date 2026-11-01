// Playwright config for the inspection e2e suites (see README.md in this folder).
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  workers: 1,
  fullyParallel: false,
  timeout: 6 * 60_000,
  expect: { timeout: 30_000 },   // canvas controls update asynchronously
  reporter: [["list"], ["html", { open: "never" }]],
});
