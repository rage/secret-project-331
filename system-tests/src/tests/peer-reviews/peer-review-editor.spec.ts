import { test } from "@playwright/test"

import { showNextToastsInfinitely, showToastsNormally } from "../../utils/notificationUtils"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

import { selectOrganization } from "@/utils/organizationUtils"
test.use({
  storageState: "src/states/admin@example.com.json",
})
test("create peer review", async ({ page }) => {
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    await selectOrganization(page, "University of Helsinki, Department of Computer Science"),
  ])

  await page.locator("[aria-label=\"Manage course \\'Introduction to everything\\'\"] svg").click()

  await page.getByText("Pages").click()

  await page
    .getByRole("row", { name: "Page One /chapter-1/page-1" })
    .getByRole("button")
    .first()
    .click()

  await page.getByText("Peer and self review configuration").click()
  await page.getByText("Add peer review").check()
  await page.getByText("Use course default peer review config").uncheck()

  await page.getByText("Add peer review question").click()
  // Fill text=Insert question here
  await page.getByText("Insert question here").fill("first question")

  await page.getByText("Save").nth(3).click()
  await page.getByText(`Operation successful`).waitFor()
})

test("default peer review editing", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await selectOrganization(page, "University of Helsinki, Department of Computer Science")

  await page.locator("[aria-label=\"Manage course \\'Introduction to everything\\'\"] path").click()

  await page.getByText("Pages").click()

  await page
    .getByRole("row", { name: "Page One /chapter-1/page-1" })
    .getByRole("button")
    .first()
    .click()

  await page.getByText("Peer and self review configuration").click()
  await page.getByText("Use course default peer review config").click()

  const [page1] = await Promise.all([
    page.waitForEvent("popup"),
    page.locator(`a:has-text("Course default peer review config")`).click(),
  ])

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page1,
    headless,
    testInfo,
    snapshotName: "default-peer-review-editor",
    waitForTheseToBeVisibleAndStable: [page1.locator('text="Configure review answers option"')],
  })

  await page1.locator('input[type="number"]').first().click()
  // Fill input[type="number"] >> nth=0
  await page1.locator('input[type="number"]').first().fill("3")

  await page1.locator('input[type="number"]').nth(1).click()
  // Fill input[type="number"] >> nth=1
  await page1.locator('input[type="number"]').nth(1).fill("4")
  // Select ManualReviewEverything
  await page1.getByLabel("Peer review processing").selectOption("ManualReviewEverything")

  await page1.getByRole("button", { name: "Delete" }).nth(1).click()
  // Fill text=General comments
  await page1.getByText("General comments").fill("test")

  await showNextToastsInfinitely(page1)
  await page1.getByText("Save").click()
  await page1.getByText(`Operation successful`).waitFor()
  await showToastsNormally(page1)
})
