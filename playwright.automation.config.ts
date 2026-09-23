import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: ["**/e2e/specs/*.spec.ts", "**/automation/specs/*.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  outputDir: "automation-results/evidence",
  reporter: [
    ["list"],
    ["json", { outputFile: "automation-results/playwright.json" }],
    ["html", { outputFolder: "automation-results/playwright-html", open: "never" }],
    ["allure-playwright", { resultsDir: "automation-results/allure-results", suiteTitle: true }],
    ["./scripts/automation/reporter.ts"],
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on",
    screenshot: "on",
    video: "on",
    ...devices["Desktop Chrome"],
  },
  projects: [{ name: "chromium" }],
  webServer: {
    command: "npm start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
