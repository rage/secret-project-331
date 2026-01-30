import { expect, test } from "@playwright/test"

import { ChapterSelector } from "../../utils/components/ChapterSelector"
import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

import { respondToConfirmDialog } from "@/utils/dialogs"
import { selectOrganization } from "@/utils/organizationUtils"
test.use({
  storageState: "src/states/user@example.com.json",
})

test("Generating certificates works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Computer Science")
  await page.getByRole("link", { name: "Navigate to course 'Certificates'" }).click()

  await selectCourseInstanceIfPrompted(page)

  const chapterSelector = new ChapterSelector(page)
  await chapterSelector.clickChapter(1)
  await page.getByRole("link", { name: "1 Page One" }).click()
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("checkbox", { name: "b" })
    .click()
  await page.getByRole("button", { name: "Submit" }).click()
  await page.getByText("Try again").waitFor()
  await page.getByRole("link", { name: "Certificates" }).click()
  await page.getByRole("button", { name: "Generate certificate for completion" }).first().click()
  await page.getByLabel("Your name  *").fill("Example User")

  await page.getByRole("button", { name: "Generate" }).click()
  await respondToConfirmDialog(page, true)
  await expect(page).toHaveURL(/.*\/certificates\/.*/)
  await page.getByText("Save as png").waitFor()
  const currentUrl = page.url()
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
})
