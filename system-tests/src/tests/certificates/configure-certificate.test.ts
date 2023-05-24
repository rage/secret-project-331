import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("test", async ({ page, headless }, testInfo) => {
  // go to config page
  await page.goto("http://project-331.local/")
  await page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()
  await page.getByRole("link", { name: "Manage course 'Certificates'" }).click()
  await page.getByRole("tab", { name: "Course instances" }).click()
  await page.getByRole("link", { name: "Manage certificates (Default)" }).click()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "management-page",
  })

  // disable/enable generating certs with confirmation dialog
  page.once("dialog", (dialog) => {
    console.log(`Dialog message: ${dialog.message()}`)
    dialog.dismiss()
  })
  await page.getByRole("button", { name: "Disable generating certifications" }).click()

  // edit with cancel and save
  await page.getByRole("button", { name: "Edit" }).click()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "editing-config",
    scrollToYCoordinate: 0,
  })
  await page.getByRole("button", { name: "Cancel" }).click()
  await page.getByRole("button", { name: "Edit" }).click()
  await page.locator("#dateTextAnchor").selectOption("middle")
  await page.getByRole("button", { name: "Save" }).click()

  // delete with confirm
  page.once("dialog", (dialog) => {
    console.log(`Dialog message: ${dialog.message()}`)
    dialog.accept()
  })
  await page.getByRole("button", { name: "Delete" }).click()

  // cancel creation
  await page
    .getByRole("listitem")
    .filter({
      hasText: "Default module",
    })
    .getByRole("button", { name: "Create certificate configuration" })
    .click()
  await page.getByRole("button", { name: "Cancel" }).click()
})
