import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./playwright",
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  outputDir: "test-results",
  use: {
    trace: "retain-on-failure",
    screenshot: { mode: "only-on-failure", fullPage: true },
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
})
