import {
  expect,
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  test,
} from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.describe("Uploading media as admin", async () => {
  // As Admin
  test.use({
    storageState: "src/states/admin@example.com.json",
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

  test("test", async ({ page, headless }) => {
    await Promise.all([
      page.waitForNavigation(),
      await page.click("text=University of Helsinki, Department of Computer Science"),
    ])
    expect(page.url().startsWith("http://project-331.local/org/")).toBe(true)

    await Promise.all([
      page.waitForNavigation(),
      page.click("[aria-label=\"Manage course 'Introduction to everything'\"] svg"),
    ])
    expect(page.url().startsWith("http://project-331.local/manage/courses/")).toBe(true)

    await Promise.all([page.waitForNavigation(), page.click("text=Pages")])

    await Promise.all([
      page.waitForNavigation(),
      page.click(
        `button:text("Edit page"):right-of(:text("Welcome to Introduction to Everything"))`,
      ),
    ])
    expect(page.url().startsWith("http://project-331.local/cms/pages/")).toBe(true)

    await page.locator(`[aria-label="Add default block"]`).click()
    await page
      .locator(`[aria-label="Empty block; start writing or type forward slash to choose a block"]`)
      .type(`/image`)

    await page.click('text="Image"')

    // Upload file with fileChooser
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.click('button:has-text("Upload")'),
    ])
    await fileChooser.setFiles("src/fixtures/media/welcome_exercise_decorations.png")

    // This is needed so we get another Gutenberg popup "disabled".
    await page.click('img[alt="Add alt"]')
    await page.click("text=Replace")

    const [newPage] = await Promise.all([page.waitForEvent("popup"), page.click("a[href$='.png']")])

    await expectScreenshotsToMatchSnapshots({
      axeSkip: [
        "html-has-lang",
        "image-alt",
        "landmark-one-main",
        "page-has-heading-one",
        "region",
      ],
      screenshotTarget: newPage,
      snapshotName: "uploadMediaPicture.png",

      headless,
    })
  })
})
