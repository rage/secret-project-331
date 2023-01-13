import { chromium, FullConfig } from "@playwright/test"
import { spawnSync } from "child_process"
import { stat, statSync } from "fs"
import path from "path"
import which from "which"

import playWrightPackageJson from "../../node_modules/playwright/package.json"
import systemTestsPackageLockJson from "../../package-lock.json"
import { login } from "../utils/login"

async function globalSetup(config: FullConfig): Promise<void> {
  await makeSureNecessaryProgramsAreInstalled(config)
  await makeSureNpmCiHasBeenRan()
  await setupSystemTestDb()
  await createLoginStates()
}

const ONE_WEEK_MS = 10 * 10 * 10 * 60 * 60 * 24 * 7

async function makeSureNecessaryProgramsAreInstalled(config: FullConfig) {
  if (config.updateSnapshots === "all") {
    if (which.sync("oxipng", { nothrow: true }) === null) {
      throw new Error(
        "oxipng is not installed or is not in the $PATH. Please install it (see https://github.com/shssoichiro/oxipng).",
      )
    }
  }
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

/** Create session states for each user, state will be named as username, e.g. admin.json
 * See https://playwright.dev/docs/auth#reuse-signed-in-state
 */
async function createLoginStates() {
  const usersLoginInformationToCache = [
    { email: "admin@example.com", password: "admin" },
    { email: "teacher@example.com", password: "teacher" },
    { email: "language.teacher@example.com", password: "language.teacher" },
    { email: "user@example.com", password: "user" },
    { email: "assistant@example.com", password: "assistant" },
    { email: "creator@example.com", password: "creator" },
  ]
  // Creating the storage states for different users takes some time, so we'll avoid doing it again if the stored state has been already created recently.
  // Using older storage states would run into problems with cookie expiry. A different solution could modify the saved storage states
  // to remove the cookie expiry times
  const allStorageStatesRecentlyCreated = usersLoginInformationToCache.every((loginInformation) => {
    try {
      const fileStats = statSync(path.join(__dirname, `../states/${loginInformation.email}.json`))
      if (new Date().getTime() - fileStats.mtime.getTime() < ONE_WEEK_MS) {
        return true
      }
      return false
    } catch (e) {
      return false
    }
  })
  if (allStorageStatesRecentlyCreated) {
    console.info(
      "All login states (=saved cookies for logging in) have been generated within the last week. Skipping generation and using existing ones.",
    )
    console.info(
      "Note: If you want to regenerate the login statesnow, delete the json files in the 'src/states' folder.",
    )
    console.info()
    return
  }
  console.log("Creating login states for supported test users.")
  const browser = await chromium.launch()
  const page = await browser.newPage()
  for (const userLoginInformation of usersLoginInformationToCache) {
    await login(userLoginInformation.email, userLoginInformation.password, page)
    console.log(`Created login state for ${userLoginInformation.email}`)
  }
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
