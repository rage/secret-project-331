import {
  expect,
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  test,
} from "@playwright/test"

import { logout } from "../../utils/logout"

test.describe("Login session with Playwright", async () => {
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
      await page.goto("http://project-331.local")
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
    expect(await page.waitForSelector("text=Log out")).toBeTruthy()
  })

  test("able to logout", async ({ page }) => {
    await logout(page)
    expect(await page.waitForSelector("text=Log in")).toBeTruthy()
  })
})

test.describe("Login return_to", async () => {
  test.beforeEach(
    async ({
      page,
    }: PlaywrightTestArgs &
      PlaywrightTestOptions &
      PlaywrightWorkerArgs &
      PlaywrightWorkerOptions) => {
      // Executed before each test
      await page.goto("http://project-331.local")
    },
  )

  test("works after succesful login", async ({ page }) => {
    await Promise.all([
      page.locator("text=University of Helsinki, Department of Computer Science").click(),
    ])
    expect(page.url().startsWith("http://project-331.local/org/")).toBe(true)

    await page.locator("id=main-navigation-menu").click()
    await page.locator("text=Log in").click()
    await page.waitForSelector(`label:has-text("Password")`)
    expect(page.url().startsWith("http://project-331.local/login?return_to=")).toBe(true)

    await page.click(`label:has-text("Email")`)
    // Fill input[name="email"]
    await page.fill(`label:has-text("Email")`, "admin@example.com")

    await page.click(`label:has-text("Password")`)
    // Fill input[name="password"]
    await page.fill(`label:has-text("Password")`, "admin")

    await page.locator("id=login-button").click()
    expect(page.url().startsWith("http://project-331.local/org/")).toBe(true)
  })
})
