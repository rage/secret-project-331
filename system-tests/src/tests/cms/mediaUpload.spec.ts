import {
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  test,
} from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

import { selectOrganization } from "@/utils/organizationUtils"

test.describe("Uploading media as admin", () => {
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
      await page.goto("http://project-331.local/organizations")
    },
  )

  test("Uploading images in the image block works", async ({ page, headless }, testInfo) => {
    await page.getByText("University of Helsinki, Department of Computer Science").click()
    await selectOrganization(page, "University of Helsinki, Department of Computer Science")

    await page.locator("[aria-label=\"Manage course 'Introduction to everything'\"] svg").click()

    await page.getByText("Pages").click()

    await page
      .locator(`button:text("Edit page"):right-of(:text("Welcome to Introduction to Everything"))`)
      .click()

    await page.locator(`[aria-label="Add default block"]`).click()
    await page
      .locator(`[aria-label="Empty block; start writing or type forward slash to choose a block"]`)
      .type(`/image`)

    await page.locator('text="Image"').click()

    // Upload file with fileChooser
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.locator('button:has-text("Upload")').click(),
    ])
    await fileChooser.setFiles("src/fixtures/media/welcome_exercise_decorations.png")

    const uploadedImageLink = page.locator("a[href*='welcome_exercise_decorations.png']").first()
    await uploadedImageLink.waitFor()

    const [newPage] = await Promise.all([page.waitForEvent("popup"), uploadedImageLink.click()])

    await expectScreenshotsToMatchSnapshots({
      axeSkip: [
        "html-has-lang",
        "image-alt",
        "landmark-one-main",
        "page-has-heading-one",
        "region",
      ],
      screenshotTarget: newPage,
      snapshotName: "uploadMediaPicture",
      headless,
      testInfo,
    })
  })
})
