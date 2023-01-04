import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})
test("blocks render correctly", async ({ page, headless }) => {
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
    page.click("text=User Experience"),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cscourses/introduction-to-course-material/chapter-2/content-rendering' }*/),
    page.click("text=Content rendering"),
  ])

  await page.waitForSelector("text=100px wide")

  await expectScreenshotsToMatchSnapshots({
    axeSkip: [],
    screenshotTarget: page,
    headless,
    snapshotName: "content-components-renderer-view",
    waitForTheseToBeVisibleAndStable: undefined,
    screenshotOptions: { fullPage: true },
  })
})
