// Does the rest of the global setup after globalSetup.ts but does it with a test so that we get playwright tracess if this happens to fail

import { BrowserContext, Page, test } from "@playwright/test"
import { statSync } from "fs"
import path from "path"

import { login } from "../utils/login"

const ONE_WEEK_MS = 10 * 10 * 10 * 60 * 60 * 24 * 7

test("Global setup, setting up login states", async ({ page, context }) => {
  await createLoginStates(page, context)
})

/** Create session states for each user, state will be named as username, e.g. admin.json
 * See https://playwright.dev/docs/auth#reuse-signed-in-state
 */
async function createLoginStates(page: Page, context: BrowserContext) {
  const usersLoginInformationToCache = [
    { email: "admin@example.com", password: "admin" },
    { email: "teacher@example.com", password: "teacher" },
    { email: "language.teacher@example.com", password: "language.teacher" },
    { email: "material.viewer@example.com", password: "material.viewer" },
    { email: "user@example.com", password: "user" },
    { email: "student1@example.com", password: "student.1" },
    { email: "student2@example.com", password: "student.2" },
    { email: "assistant@example.com", password: "assistant" },
    { email: "creator@example.com", password: "creator" },
    {
      email: "teaching-and-learning-services@example.com",
      password: "teaching-and-learning-services",
    },
    {
      email: "langs@example.com",
      password: "langs",
    },
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
      "Note: If you want to regenerate the login states now, delete the json files in the 'src/states' folder.",
    )
    console.info()
    return
  }
  console.log("Creating login states for supported test users.")
  for (const userLoginInformation of usersLoginInformationToCache) {
    await login(userLoginInformation.email, userLoginInformation.password, page, true)
    console.log(`Created login state for ${userLoginInformation.email}`)
    await context.clearCookies()
    await page.goto("about:blank")
    await page.waitForLoadState()
    await context.clearCookies()
  }
}
