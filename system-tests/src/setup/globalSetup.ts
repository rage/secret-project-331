import { chromium } from "@playwright/test"

import playWrightPackageJson from "../../node_modules/playwright/package.json"
import systemTestsPackageLockJson from "../../package-lock.json"
import { login } from "../utils/login"

async function globalSetup(): Promise<void> {
  await makeSureNpmCiHasBeenRan()
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
}

export default globalSetup
