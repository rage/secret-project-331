import { expect, test } from "@playwright/test"

import { respondToConfirmDialog } from "@/utils/dialogs"
import { selectOrganization } from "@/utils/organizationUtils"

import { ChapterSelector } from "../../utils/components/ChapterSelector"
import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { getExerciseTaskFrame } from "../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
test.use({
  storageState: "src/states/user@example.com.json",
})

test("Generating certificates works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Computer Science")
  await page.getByRole("link", { name: "Certificates", exact: true }).click()

  await selectCourseInstanceIfPrompted(page)

  const chapterSelector = new ChapterSelector(page)
  await chapterSelector.clickChapter(1)
  await page.getByRole("link", { name: "1 Page One" }).click()
  await getExerciseTaskFrame(page, 1).getByRole("checkbox", { name: "b" }).click()
  await page.getByRole("button", { name: "Submit" }).click()
  await page.getByText("Try again").waitFor()
  await page.getByRole("link", { name: "Certificates" }).click()
  await page.getByRole("link", { name: "Generate certificate for completion" }).first().click()
  await page.getByLabel("Your name").fill("Example User")

  await page.getByRole("button", { name: "Generate" }).click()
  await respondToConfirmDialog(page, true)
  await expect(page).toHaveURL(/.*\/certificates\/.*/)
  await page.getByText("Save as png").waitFor()
  const currentUrl = page.url()
  await expect(page.getByRole("heading", { name: "Certificate details" })).toBeVisible()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "certificate-details",
    // The random verification id is replaced, not masked: glyphs such as a leading "j" paint
    // outside their element's box, so a mask leaves stray pixels.
    beforeScreenshot: async () => {
      await page
        .getByText("Verification id", { exact: true })
        .locator("xpath=following-sibling::dd[1]/span[1]")
        .evaluate((element) => (element.textContent = "abcdefghijkmnpq"))
    },
    // The issue date is the day of the run
    screenshotOptions: {
      fullPage: true,
      mask: [
        page.getByText("Issued", { exact: true }).locator("xpath=following-sibling::dd[1]"),
        page.getByRole("img", { name: "Certificate image" }),
      ],
    },
    waitForTheseToBeVisibleAndStable: [
      page.getByRole("img", { name: "Certificate image" }),
      page.getByRole("heading", { name: "Certificate details" }),
    ],
    scrollToYCoordinate: 0,
  })
  await page.goto(`${currentUrl}?debug=true`)
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "generated-certificate",
    waitForTheseToBeVisibleAndStable: [
      page.getByRole("img", { name: "Certificate for completing a course module" }),
    ],
    scrollToYCoordinate: 0,
  })

  await test.step("The certificate is listed on the holder's own profile", async () => {
    await page.goto("http://project-331.local/profile/studies")
    await expect(page.getByRole("heading", { name: "My certificates" })).toBeVisible()
    await expect(page.getByRole("link", { name: "View certificate" }).first()).toBeVisible()
  })
})
