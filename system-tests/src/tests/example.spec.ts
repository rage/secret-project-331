import {
  expect,
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  test,
} from "@playwright/test"

import { logout } from "../utils/logout"

test.describe("Login session with Playwright", async () => {
  /// Login state to use
  test.use({ storageState: "src/states/admin.json" })
  // test.use({ storageState: 'src/states/teacher.json' })
  // test.use({ storageState: 'src/states/user.json' })

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
    expect(await page.waitForSelector("button[name=logout]")).toBeTruthy()
  })

  test("able to logout", async ({ page }) => {
    await logout(page)
    await page.goto("http://project-331.local")
    expect(await page.waitForSelector("text=Login")).toBeTruthy()
  })
})
