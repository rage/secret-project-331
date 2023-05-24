import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("test", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")
  await page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()
  await page.getByRole("link", { name: "Navigate to course 'Certificates'" }).click()
  await page.getByText("Default", { exact: true }).click()
  await page.getByTestId("select-course-instance-continue-button").click()
  await page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
  await page.getByRole("link", { name: "1 Page One" }).click()
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("checkbox", { name: "b" })
    .click()
  await page.getByRole("button", { name: "Submit" }).click()
  await page.getByRole("link", { name: "Certificates" }).click()
  await page.getByRole("button", { name: "Generate certificate for completion" }).click()
  await page.getByLabel("Your name  *").fill("Example User")
  page.once("dialog", (dialog) => {
    console.log(`Dialog message: ${dialog.message()}`)
    dialog.accept()
  })
  await page.getByRole("button", { name: "Generate" }).click()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "generated-certificate",
    waitForTheseToBeVisibleAndStable: [
      page.getByRole("img", { name: "Certificate for completing a course module" }),
    ],
  })
})
