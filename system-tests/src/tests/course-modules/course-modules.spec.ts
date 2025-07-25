import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

import { selectOrganization } from "@/utils/organizationUtils"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Course modules test", async ({ page, headless }, testInfo) => {
  test.slow()
  // navigate to module page
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Computer Science")
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")
  await page.locator("[aria-label=\"Manage course \\'Course Modules\\'\"] path").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/edaa1c52-15cd-458d-8ce2-1e4010641244",
  )
  await page.getByRole("tab", { name: "Modules" }).click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/edaa1c52-15cd-458d-8ce2-1e4010641244/modules",
  )
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "initial-module-management-page",
    waitForTheseToBeVisibleAndStable: [page.getByRole("heading", { name: "Modules" })],
    screenshotOptions: { fullPage: true },
  })

  // delete a module
  await page.locator('[aria-label="Delete"]').first().click()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "after-deletion",

    screenshotOptions: { fullPage: true },
  })

  // reset deletion
  await page.getByText("Reset").click()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "after-deletion-reset",

    screenshotOptions: { fullPage: true },
  })

  // create invalid module
  await page.locator('[placeholder="Name of module"]').fill("invalid module")
  await page.locator("#new-module-start").selectOption("2")
  await page.locator("#new-module-ends").selectOption("3")
  await page.getByText("Confirm").click()
  await page.getByText("Error: Default module has missing chapters between 1 and 4").waitFor()

  // update invalid module to be valid
  await page.locator('[aria-label="Edit"]').nth(1).click()
  await page.locator('[placeholder="Name of module"]').nth(0).fill("valid module")
  await page.locator("#editing-module-ends").selectOption("4")
  await page.locator('[aria-label="Confirm"]').click()
  await page
    .getByText("Error: Default module has missing chapters between 1 and 4")
    .waitFor({ state: "hidden" })

  // delete module
  await page.locator('[aria-label="Delete"]').nth(1).click()

  // update last module
  await page.locator('[aria-label="Edit"]').nth(2).click()
  await page.locator('[placeholder="Name of module"]').nth(0).fill("renamed module")
  await page.locator("#editing-module-start").selectOption("3")
  await page.locator('[aria-label="Confirm"]').click()
  await page.getByText("2. renamed module").waitFor()

  // save changes
  await page.getByText("Save changes").click()
  await page.getByText("Success").first().waitFor()
})
