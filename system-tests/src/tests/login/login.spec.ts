import {
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  test,
} from "@playwright/test"

import { logout } from "../../utils/logout"

import { selectOrganization } from "@/utils/organizationUtils"

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
    await page.locator("id=topbar-user-menu").waitFor()
  })

  test("able to logout", async ({ page }) => {
    await logout(page)
    await page.getByRole("link", { name: "Log in" }).waitFor()
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
      await selectOrganization(page, "University of Helsinki, Department of Computer Science"),
    ])
    await page.waitForURL(/http:\/\/project-331\.local\/org\/.*/)
    const currentUrl = page.url()

    const returnTo = encodeURIComponent(currentUrl)
    await page.goto(`http://project-331.local/login?return_to=${returnTo}`)
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
