import { chromium } from "@playwright/test"
import { spawnSync } from "child_process"
import path from "path"

import playWrightPackageJson from "../../node_modules/playwright/package.json"
import systemTestsPackageLockJson from "../../package-lock.json"
import { login } from "../utils/login"

async function globalSetup(): Promise<void> {
  await makeSureNpmCiHasBeenRan()
  await setupSystemTestDb()
  await createLoginStates()
}

async function makeSureNpmCiHasBeenRan() {
  // Make sure the user has ran npm ci after Playwright has been updated.
  // Using an older vesion might not work or might generate sligtly wrong screenshots.
  const requiredPlaywrightVersion = systemTestsPackageLockJson.dependencies.playwright.version
  const installedPlaywrightVersion = playWrightPackageJson.version
  if (installedPlaywrightVersion !== requiredPlaywrightVersion) {
    throw new Error(
      `The installed Playwright version ${installedPlaywrightVersion} is not the same as the required version ${requiredPlaywrightVersion}. Please run npm ci in the system-tests folder.`,
    )
  }
}

// Create session states for each user, state will be named as username, e.g. admin.json
async function createLoginStates() {
  console.log("Creating login states for supported test users.")
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await login("admin@example.com", "admin", page)
  await login("teacher@example.com", "teacher", page)
  await login("language.teacher@example.com", "language.teacher", page)
  await login("user@example.com", "user", page)
  await login("assistant@example.com", "assistant", page)
  await login("creator@example.com", "creator", page)
  await browser.close()
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
    if (res.error) {
      console.error("Error: Could not setup system test db.")
      throw res.error
    }
    console.log("System test db setup complete.")
  } finally {
    console.timeEnd("system-test-db-setup")
  }
}

export default globalSetup
