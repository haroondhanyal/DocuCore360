import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/release",
  outputDir: "test-results-cross-browser",
  workers: 1,
  timeout: 90000,
  reporter: "list",
  use: { baseURL: "http://localhost:3000", screenshot: "only-on-failure" },
  projects: [
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
