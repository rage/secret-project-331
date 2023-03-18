import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})
test("blocks render correctly", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(),
    page.click(
      '[id="__next"] div >> :nth-match(div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer "), 4)',
    ),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-course-material' }*/),
    page.click(`div:text-is("Introduction to Course Material")`),
  ])

  await selectCourseInstanceIfPrompted(page)

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-2' }*/),
    page.locator("text=User Experience").click(),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cscourses/introduction-to-course-material/chapter-2/content-rendering' }*/),
    page.locator("text=Content rendering").click(),
  ])

  await page.waitForSelector("text=100px wide")

  await expectScreenshotsToMatchSnapshots({
    // TODO: these should be removed
    axeSkip: ["color-contrast", "empty-table-header"],
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "content-components-renderer-view",
    waitForTheseToBeVisibleAndStable: undefined,
    screenshotOptions: { fullPage: true },
  })
})
