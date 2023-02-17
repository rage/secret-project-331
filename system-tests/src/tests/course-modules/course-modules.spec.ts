import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Course modules test", async ({ page, headless }) => {
  test.slow()
  // navigate to module page
  await page.goto("http://project-331.local/")
  await page.locator("text=University of Helsinki, Department of Computer Science").click()
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
    page,
    headless,
    snapshotName: "initial-module-management-page",
    waitForThisToBeVisibleAndStable: "text=Modules",
    toMatchSnapshotOptions: { threshold: 0.4 },
    pageScreenshotOptions: { fullPage: true },
  })

  // delete a module
  await page.locator('[aria-label="Delete"]').first().click()
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "after-deletion",
    toMatchSnapshotOptions: { threshold: 0.4 },
    pageScreenshotOptions: { fullPage: true },
  })

  // reset deletion
  await page.locator("text=Reset").click()
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "after-deletion-reset",
    toMatchSnapshotOptions: { threshold: 0.4 },
    pageScreenshotOptions: { fullPage: true },
  })

  // create invalid module
  await page.locator('[placeholder="Name of module"]').fill("invalid module")
  await page.locator("#new-module-start").selectOption("2")
  await page.locator("#new-module-ends").selectOption("3")
  await page.locator("text=Confirm").click()
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "after-creating-new-module",
    waitForThisToBeVisibleAndStable: "text=1: invalid module",
    toMatchSnapshotOptions: { threshold: 0.4 },
    pageScreenshotOptions: { fullPage: true },
  })

  // update invalid module to be valid
  await page.locator('[aria-label="Edit"]').nth(1).click()
  await page.locator('[placeholder="Name of module"]').nth(1).fill("valid module")
  await page.locator("#editing-module-ends").selectOption("4")
  await page.locator('[aria-label="Save"]').click()
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "after-updating-new-module",
    waitForThisToBeVisibleAndStable: "text=1: valid module",
    toMatchSnapshotOptions: { threshold: 0.4 },
    pageScreenshotOptions: { fullPage: true },
  })

  // delete module
  await page.locator('[aria-label="Delete"]').nth(1).click()
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "after-second-deletion",
    toMatchSnapshotOptions: { threshold: 0.4 },
    pageScreenshotOptions: { fullPage: true },
  })

  // update last module
  await page.locator('[aria-label="Edit"]').nth(2).click()
  await page.locator('[placeholder="Name of module"]').nth(1).fill("renamed module")
  await page.locator("#editing-module-start").selectOption("3")
  await page.locator('[aria-label="Save"]').click()
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "after-last-update",
    waitForThisToBeVisibleAndStable: "text=2: renamed module",
    toMatchSnapshotOptions: { threshold: 0.4 },
    pageScreenshotOptions: { fullPage: true },
  })

  // save changes
  await page.locator("text=Save changes").click()
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "after-saving",
    waitForThisToBeVisibleAndStable: "text=Success",
    toMatchSnapshotOptions: { threshold: 0.4 },
    pageScreenshotOptions: { fullPage: true },
  })
})
