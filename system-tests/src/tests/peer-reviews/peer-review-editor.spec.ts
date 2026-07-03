import { expect, type Page, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
import waitForSpinnersToDisappear from "../../utils/waitForSpinnersToDisappear"

import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"

/**
 * These checkboxes are controlled through Gutenberg block attributes, and Gutenberg re-renders
 * non-selected blocks asynchronously — the DOM can reflect a click only after an idle callback.
 * setChecked() asserts the state immediately after clicking and fails on that race, so click and
 * poll instead, re-clicking if needed.
 */
async function setPeerReviewCheckbox(page: Page, label: string, checked: boolean) {
  const checkbox = page.getByRole("checkbox", { name: label, exact: true })
  await expect(async () => {
    if ((await checkbox.isChecked()) !== checked) {
      await checkbox.click()
    }
    await expect(checkbox).toBeChecked({ checked, timeout: 2000 })
  }).toPass()
}

test.use({
  storageState: "src/states/admin@example.com.json",
})

async function openPeerReviewConfig(page: Page) {
  await page.goto("http://project-331.local/organizations")

  await selectOrganization(page, "University of Helsinki, Department of Computer Science")

  await page.locator("[aria-label=\"Manage course \\'Introduction to everything\\'\"] svg").click()

  await page.getByText("Pages").click()

  await page
    .getByRole("row", { name: "Page One /chapter-1/page-1" })
    .getByRole("button")
    .first()
    .click()

  await page.getByText("Peer and self review configuration").click()
  await waitForSpinnersToDisappear(page, "Peer review editor did not finish loading")
}

test("create peer review", async ({ page }) => {
  await openPeerReviewConfig(page)

  await setPeerReviewCheckbox(page, "Add peer review", true)
  await setPeerReviewCheckbox(page, "Use course default peer review config", false)

  await page.getByText("Add peer review question").click()
  // Fill text=Insert question here
  await page.getByText("Insert question here").fill("first question")

  await waitForSuccessNotification(page, async () => {
    await page.getByText("Save").nth(3).click()
  })
})

test("default peer review editing", async ({ page, headless }, testInfo) => {
  await openPeerReviewConfig(page)

  // "Use course default" only renders once peer review is enabled.
  await setPeerReviewCheckbox(page, "Add peer review", true)
  await setPeerReviewCheckbox(page, "Use course default peer review config", true)

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

  await waitForSuccessNotification(page1, async () => {
    await page1.getByText("Save").click()
  })
})
