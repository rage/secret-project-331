import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})
test("blocks render correctly", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.click(
      '[id="__next"] div >> :nth-match(div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer "), 4)',
    ),
  ])

  await page.click(`div:text-is("Introduction to Course Material")`)

  await selectCourseInstanceIfPrompted(page)

  await page.getByText("User Experience").click()

  await page.getByText("Content rendering").click()

  await page.getByText("100px wide").waitFor()

  await expectScreenshotsToMatchSnapshots({
    // TODO: these should be removed
    axeSkip: ["color-contrast", "empty-table-header"],
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "content-components-renderer-view",
    waitForTheseToBeVisibleAndStable: undefined,
    // taking the large screenshot sometimes times out even with 5000ms
    screenshotOptions: { fullPage: true, timeout: 10_000 },
  })
})
