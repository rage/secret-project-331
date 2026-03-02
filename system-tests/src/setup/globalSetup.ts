import { FullConfig } from "@playwright/test"
import { spawnSync } from "child_process"
import fs from "fs"
import { load as yamlLoad } from "js-yaml"
import path from "path"
import playWrightPackageJson from "playwright/package.json"
import which from "which"

async function globalSetup(config: FullConfig): Promise<void> {
  await makeSureNecessaryProgramsAreInstalled(config)
  await makeSurePnpmInstallHasBeenRan()
  await downloadTmcLangsCli()
  await setupSystemTestDb()
  // After this global.setup.spec.ts is ran
}

async function makeSureNecessaryProgramsAreInstalled(config: FullConfig) {
  if (config.updateSnapshots === "all" || !process.env.CI) {
    if (which.sync("oxipng", { nothrow: true }) === null) {
      throw new Error(
        "oxipng is not installed or is not in the $PATH. Please install it (see https://github.com/shssoichiro/oxipng).",
      )
    }
  }
}

async function makeSurePnpmInstallHasBeenRan() {
  // Ensure pnpm install has been run after Playwright version changes.
  const pnpmLockPath = path.join(__dirname, "../../pnpm-lock.yaml")
  const pnpmLockContent = fs.readFileSync(pnpmLockPath, "utf8")
  const pnpmLock = yamlLoad(pnpmLockContent) as {
    importers?: Record<
      string,
      {
        devDependencies?: Record<string, string | { version: string; specifier: string }>
        dependencies?: Record<string, string | { version: string; specifier: string }>
      }
    >
  }

  // Find the importer for the system-tests workspace (fallback to root if needed).
  const importer = pnpmLock?.importers?.["system-tests"] ?? pnpmLock?.importers?.["."] ?? null
  if (!importer) {
    console.warn(
      "pnpm-lock.yaml: no importer for system-tests or root; skipping Playwright version check",
    )
    return
  }

  // Lockfile stores resolved versions under devDependencies/dependencies.
  const playwrightEntry = importer.devDependencies?.playwright ?? importer.dependencies?.playwright

  if (!playwrightEntry) {
    console.warn("pnpm-lock.yaml: Playwright not found in importer; skipping version check")
    return
  }

  const requiredPlaywrightVersion =
    typeof playwrightEntry === "string" ? playwrightEntry : playwrightEntry.version

  const installedPlaywrightVersion = playWrightPackageJson.version
  if (installedPlaywrightVersion !== requiredPlaywrightVersion) {
    throw new Error(
      `The installed Playwright version ${installedPlaywrightVersion} is not the same as the required version ${requiredPlaywrightVersion}. Please run pnpm install in the system-tests folder.`,
    )
  }
}

// Download the langs CLI binary for the TMC exercise service to work.
async function downloadTmcLangsCli() {
  try {
    console.time("tmc-langs-setup")
    const downloadTmcLangsPath = path.join(__dirname, "../../../bin/tmc-langs-setup")
    console.log("Downloading langs CLI.")
    const res = spawnSync(downloadTmcLangsPath, { stdio: "inherit" })
    if (res.status != 0) {
      console.error("Error: Could not download langs CLI.")
      if (res.error) {
        throw res.error
      } else {
        throw new Error(`Downloading langs CLI returned non-zero status code ${res.status}`)
      }
    }
    console.log("Successfully downloaded langs CLI.")
  } finally {
    console.timeEnd("tmc-langs-setup")
  }
}

// The setup system test db called by playwright to make the playwright vscode extension to work.
async function setupSystemTestDb() {
  try {
    console.time("system-test-db-setup")
    const setupSystemTestDbScriptPath = path.join(__dirname, "../../../bin/setup-system-test-db")
    console.log("Setting up system test db.")
    // spawnSync is the easiest way to wait for the script to finish while inheriting stdio.
    // Using a sync method hare shoud not be a problem since this is a setup script
    const res = spawnSync(setupSystemTestDbScriptPath, { stdio: "inherit" })
    if (res.status != 0) {
      console.error("Error: Could not setup system test db.")
      if (res.error) {
        throw res.error
      } else {
        throw new Error(`System test db setup script returned non-zero status code ${res.status}`)
      }
    }
    console.log("System test db setup complete.")
  } finally {
    console.timeEnd("system-test-db-setup")
  }
}

export default globalSetup
