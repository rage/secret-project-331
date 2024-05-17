import {
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  test,
} from "@playwright/test"

import { logout } from "../../utils/logout"

test.describe("Login session with Playwright", () => {
  /// Login state to use
  test.use({ storageState: "src/states/admin@example.com.json" })

  test.beforeAll(async (_args: PlaywrightWorkerArgs & PlaywrightWorkerOptions) => {
    // Executed once before tests
  })

  test.afterAll(async (_args: PlaywrightWorkerArgs & PlaywrightWorkerOptions) => {
    // Executed once after tests
  })

  test.beforeEach(
    async ({
      page,
    }: PlaywrightTestArgs &
      PlaywrightTestOptions &
      PlaywrightWorkerArgs &
      PlaywrightWorkerOptions) => {
      // Executed before each test
      await page.goto("http://project-331.local/organizations")
    },
  )

  test.afterEach(
    async (
      _args: PlaywrightTestArgs &
        PlaywrightTestOptions &
        PlaywrightWorkerArgs &
        PlaywrightWorkerOptions,
    ) => {
      // Executed after each test
    },
  )

  test("is succesful", async ({ page }) => {
    await page.locator("id=main-navigation-menu").click()
    await page.getByText("Log out").waitFor()
  })

  test("able to logout", async ({ page }) => {
    await logout(page)
    await page.getByText("Log in").waitFor()
  })
})

test.describe("Login return_to", () => {
  test.beforeEach(
    async ({
      page,
    }: PlaywrightTestArgs &
      PlaywrightTestOptions &
      PlaywrightWorkerArgs &
      PlaywrightWorkerOptions) => {
      // Executed before each test
      await page.goto("http://project-331.local/organizations")
    },
  )

  test("works after succesful login", async ({ page }) => {
    await Promise.all([
      page.getByText("University of Helsinki, Department of Computer Science").click(),
    ])
    await page.waitForURL(/http:\/\/project-331\.local\/org\/.*/)

    await page.locator("id=main-navigation-menu").click()
    await page.getByText("Log in").click()
    await page.locator(`label:has-text("Password")`).waitFor()
    await page.waitForURL(/http:\/\/project-331\.local\/login\?return_to=.*/)

    await page.click(`label:has-text("Email")`)
    // Fill input[name="email"]
    await page.fill(`label:has-text("Email")`, "admin@example.com")

    await page.click(`label:has-text("Password")`)
    // Fill input[name="password"]
    await page.fill(`label:has-text("Password")`, "admin")

    await page.locator("id=login-button").click()
    await page.waitForURL(/http:\/\/project-331\.local\/org\/.*/)
  })
})
