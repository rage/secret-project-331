/* eslint-disable playwright/prefer-locator */
import { expect, test } from "@playwright/test"

import { selectOrganization } from "@/utils/organizationUtils"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Chart block renders for students", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await selectOrganization(page, "University of Helsinki, Department of Computer Science")

  await page.click(`div:text-is("Introduction to Course Material")`)

  await selectCourseInstanceIfPrompted(page)

  await page.getByText("User Experience").click()
  await page.getByText("Chart rendering").click()

  // The page itself must not crash (the chart block is wrapped in an error boundary).
  await expect(page.getByText("crashed")).toBeHidden()

  // The happy-path chart shows its caption.
  const caption = page.getByText(
    "Figure 1: a simple bar chart rendered from an external data file.",
  )
  await caption.waitFor()

  // A valid spec with no data and an unparseable spec fall back to messages instead of breaking.
  await expect(page.getByText("This chart is missing its data file.")).toBeVisible()
  await expect(
    page.getByText("The chart could not be displayed because its specification is invalid."),
  ).toBeVisible()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "chart-block-render",
    waitForTheseToBeVisibleAndStable: [caption],
    screenshotOptions: { fullPage: true },
  })
})
