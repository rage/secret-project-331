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
  // Firefox and WebKit stay a local-only check. They earn their keep for File and MessageChannel
  // behaviour, which genuinely differs between engines, but CI runs chromium alone so the job needs
  // one browser download rather than three.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ...(process.env.CI
      ? []
      : [
          { name: "firefox", use: { ...devices["Desktop Firefox"] } },
          { name: "webkit", use: { ...devices["Desktop Safari"] } },
        ]),
  ],
})
