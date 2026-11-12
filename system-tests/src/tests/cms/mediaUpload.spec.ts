import type {
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
} from "@playwright/test"
import { expect, test } from "@playwright/test"

import { selectOrganization } from "@/utils/organizationUtils"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

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

    await page.getByRole("tab", { name: "Pages" }).click()

    await page
      .getByRole("row", { name: /Welcome to Introduction to Everything/ })
      .getByRole("button", { name: "Edit page" })
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

    const uploadedImage = page.locator('[data-type="core/image"] img').first()
    await expect(uploadedImage).toHaveAttribute("src", /\/images\/.+\.png$/)
    const src = await uploadedImage.getAttribute("src")
    expect(src).not.toBeNull()

    const newPage = await page.context().newPage()
    await newPage.goto(new URL(String(src), page.url()).toString(), {
      waitUntil: "domcontentloaded",
    })

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
