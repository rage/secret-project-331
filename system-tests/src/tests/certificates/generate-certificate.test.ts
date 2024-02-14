import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("Generating certificates works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")
  await page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()
  await page.getByRole("link", { name: "Navigate to course 'Certificates'" }).click()

  await selectCourseInstanceIfPrompted(page)

  await page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
  await page.getByRole("link", { name: "1 Page One" }).click()
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("checkbox", { name: "b" })
    .click()
  await page.getByRole("button", { name: "Submit" }).click()
  await page.waitForSelector("text=Try again")
  await page.getByRole("link", { name: "Certificates" }).click()
  await page.getByRole("button", { name: "Generate certificate for completion" }).first().click()
  await page.getByLabel("Your name  *").fill("Example User")
  page.once("dialog", (dialog) => {
    dialog.accept()
  })
  await page.getByRole("button", { name: "Generate" }).click()
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
