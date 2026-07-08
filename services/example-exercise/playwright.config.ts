import { defineConfig } from "@playwright/test"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// Derive the dev-server port from package.json's `dev` script so this stays correct after the
// scaffolding CLI rewrites the port for a generated project.
const configDir = dirname(fileURLToPath(import.meta.url))
const devScript =
  (JSON.parse(readFileSync(join(configDir, "package.json"), "utf8")).scripts?.dev as
    string | undefined) ?? ""
const port = Number(/--port(?:\s+|=)(\d+)/.exec(devScript)?.[1] ?? "3002")

// In the moocfi Nix dev shell chromium is on PATH but Playwright's managed browsers aren't
// installed, so point at the system chromium when PLAYWRIGHT_CHROMIUM_PATH is set. On a standalone
// machine, run `pnpm exec playwright install chromium` and leave it unset.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "pnpm run dev",
    url: `http://localhost:${port}/iframe`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
