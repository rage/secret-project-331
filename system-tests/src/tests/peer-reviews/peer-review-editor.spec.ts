import { test } from "@playwright/test"

import { showNextToastsInfinitely, showToastsNormally } from "../../utils/notificationUtils"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})
test("create peer review", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.getByText("University of Helsinki, Department of Computer Science").click(),
  ])

  await page.locator("[aria-label=\"Manage course \\'Introduction to everything\\'\"] svg").click()

  await page.getByText("Pages").click()

  await page
    .getByRole("row", { name: "Page One /chapter-1/page-1" })
    .getByRole("button")
    .first()
    .click()

  await page.getByText("Add peer review").check()
  // Uncheck text=Use course global peer reviewCourse default peer review config >> input[type="checkbox"]
  await page.getByText("Use course default peer review config").uncheck()

  await page.getByText("Add peer review question").click()
  // Fill text=Insert question here
  await page.getByText("Insert question here").fill("first question")

  await page.getByText("Save").nth(3).click()
  await page.getByText(`Operation successful`).waitFor()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "peer-review-editor-after-save",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="Peer review question type"`)],
    screenshotTarget: page,
    clearNotifications: true,
    axeSkip: ["aria-allowed-attr", "aria-allowed-role"],
  })
})

test("default peer review editing", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await page
    .locator(
      "text=University of Helsinki, Department of Computer ScienceOrganization for Computer ",
    )
    .click()

  await page.locator("[aria-label=\"Manage course \\'Introduction to everything\\'\"] path").click()

  await page.getByText("Pages").click()

  await page
    .getByRole("row", { name: "Page One /chapter-1/page-1" })
    .getByRole("button")
    .first()
    .click()

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
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page1,
    headless,
    testInfo,
    snapshotName: "default-peer-review-editor-after-save",
    waitForTheseToBeVisibleAndStable: [page1.locator('text="Add peer review question"')],
  })
  await showToastsNormally(page1)
})
