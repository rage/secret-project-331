import { readFileSync } from "node:fs"
import { join } from "node:path"

import { defineConfig, devices } from "@playwright/test"

// Derive the dev-server port from package.json's `dev` script so this stays correct after the
// scaffolding CLI rewrites the port for a generated project.
const configDir = import.meta.dirname
const devScript =
  (JSON.parse(readFileSync(join(configDir, "package.json"), "utf8")).scripts?.dev as
    | string
    | undefined) ?? ""
const port = Number(/--port(?:\s+|=)(\d+)/.exec(devScript)?.[1] ?? "3002")

// In the moocfi Nix dev shell chromium is on PATH but Playwright's managed browsers aren't
// installed, so point at the system chromium when PLAYWRIGHT_CHROMIUM_PATH is set. On a standalone
// machine, run `pnpm exec playwright install chromium` and leave it unset.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: "./playwright",
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  outputDir: "test-results",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    screenshot: { mode: "only-on-failure", fullPage: true },
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "plugin-contract-chromium",
      testMatch: /plugin-contract\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
    {
      name: "iframe-boundary-chromium",
      testMatch: /iframe-boundary\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
    {
      name: "system-chromium",
      testMatch: /system\/.*\.spec\.ts/,
      // The production Playground is slower than the local emulator.
      timeout: 90_000,
      use: {
        ...devices["Desktop Chrome"],
        // The public Playground page frames and calls this local server, which Chromium gates
        // behind Local Network Access.
        permissions: ["local-network-access"],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
    // Firefox and WebKit stay a local-only check. The iframe boundary is where engines genuinely
    // differ, but CI runs chromium alone so the job needs one browser download rather than three.
    ...(process.env.CI
      ? []
      : [
          {
            name: "iframe-boundary-firefox",
            testMatch: /iframe-boundary\/.*\.spec\.ts/,
            use: { ...devices["Desktop Firefox"] },
          },
          {
            name: "iframe-boundary-webkit",
            testMatch: /iframe-boundary\/.*\.spec\.ts/,
            use: { ...devices["Desktop Safari"] },
          },
        ]),
  ],
  webServer: {
    command: "pnpm run dev",
    url: `http://localhost:${port}/iframe`,
    reuseExistingServer: !process.env.CI,
    // The tests use root paths. A dev server already on the port with a base path answers /iframe
    // with 404, so Playwright starts its own, which then stops on rsbuild's strictPort.
    env: { PUBLIC_BASE_PATH: "" },
    timeout: 120_000,
  },
})
