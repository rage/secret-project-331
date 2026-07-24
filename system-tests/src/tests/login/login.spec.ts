import type {
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
} from "@playwright/test"
import { test } from "@playwright/test"

import { selectOrganization } from "@/utils/organizationUtils"

import { logout } from "../../utils/logout"

test.describe("Login session with Playwright", () => {
  /// Login state to use
  test.use({ storageState: "src/states/admin@example.com.json" })

  test.beforeAll(async (_args: PlaywrightWorkerArgs & PlaywrightWorkerOptions) => {
    // Executed once before tests
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

  test.afterAll(async (_args: PlaywrightWorkerArgs & PlaywrightWorkerOptions) => {
    // Executed once after tests
  })

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
    await selectOrganization(page, "University of Helsinki, Department of Computer Science")
    await page.waitForURL(/http:\/\/project-331\.local\/org\/.*/)
    const currentUrl = page.url()

    const returnTo = encodeURIComponent(currentUrl)
    await page.goto(`http://project-331.local/login?return_to=${returnTo}`)
    await page.getByRole("textbox", { name: "Password", exact: true }).waitFor()
    await page.waitForURL(/http:\/\/project-331\.local\/login\?return_to=.*/)

    await page.getByRole("textbox", { name: "Email" }).fill("admin@example.com")
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("admin")

    await Promise.all([
      page.locator("id=login-button").click(),
      page.waitForURL(/http:\/\/project-331\.local\/org\/.*/),
    ])
  })
})
