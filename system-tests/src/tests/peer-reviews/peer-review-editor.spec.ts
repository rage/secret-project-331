import { type Page, test } from "@playwright/test"

import { Checkbox } from "@/utils/components/Checkbox"
import { Select } from "@/utils/components/Select"
import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
import waitForSpinnersToDisappear from "../../utils/waitForSpinnersToDisappear"

test.use({
  storageState: "src/states/admin@example.com.json",
})

async function openPeerReviewConfig(page: Page) {
  await page.goto("http://project-331.local/organizations")

  await selectOrganization(page, "University of Helsinki, Department of Computer Science")

  await page.locator("[aria-label=\"Manage course \\'Introduction to everything\\'\"] svg").click()

  await page.getByRole("tab", { name: "Pages" }).click()

  await page
    .getByRole("row", { name: "Page One /chapter-1/page-1" })
    .getByRole("button")
    .first()
    .click()

  await page.getByText("Peer and self review configuration").click()
  // Wait out the editor's async QueryResult frames so checkbox clicks aren't lost to a re-render.
  await waitForSpinnersToDisappear(page, "Peer review editor did not finish loading")
}

test("create peer review", async ({ page }) => {
  await openPeerReviewConfig(page)

  await Checkbox.labelled(page, "Add peer review").setChecked(true)
  await Checkbox.labelled(page, "Use course default peer review config").setChecked(false)

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
  await Checkbox.labelled(page, "Add peer review").setChecked(true)
  await Checkbox.labelled(page, "Use course default peer review config").setChecked(true)

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
  await Select.labelled(page1, "Peer review processing strategy").chooseOption(
    "Manual review everything",
  )

  await page1.getByRole("button", { name: "Delete" }).nth(1).click()
  // Fill text=General comments
  await page1.getByText("General comments").fill("test")

  await waitForSuccessNotification(page1, async () => {
    await page1.getByText("Save").click()
  })
})
