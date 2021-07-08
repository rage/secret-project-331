import {
  test,
  expect,
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
} from "@playwright/test"

test.describe("Example", async () => {
  test.beforeAll(async (args: PlaywrightWorkerArgs & PlaywrightWorkerOptions) => {
    // Executed once before tests
    await args.browser.newContext({ storageState: "./src/states/admin.json" })
  })

  test.afterAll(async (_args: PlaywrightWorkerArgs & PlaywrightWorkerOptions) => {
    // Executed once after tests
  })

  test.beforeEach(
    async (
      _args: PlaywrightTestArgs &
        PlaywrightTestOptions &
        PlaywrightWorkerArgs &
        PlaywrightWorkerOptions,
    ) => {
      // Executed before each test
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
  test("test", async ({ page }) => {
    expect(await page.content()).not.toContain("Logout")
  })
})
