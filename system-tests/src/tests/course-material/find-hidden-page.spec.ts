import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("find hidden page", async ({ page, headless }) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-everything' }*/),
    page.click("text=Introduction to everything"),
  ])

  await selectCourseInstanceIfPrompted(page)

  await expectScreenshotsToMatchSnapshots({
    beforeScreenshot: () => page.locator("text=Information pages").scrollIntoViewIfNeeded(),
    clearNotifications: true,
    headless,
    screenshotTarget: page,
    snapshotName: "top-level-pages-list",
  })

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-everything/welcome' }*/),
    page.click("text=Welcome to Introduction to Everything"),
  ])

  await page.goto("http://project-331.local/org/uh-cs/courses/introduction-to-everything/hidden")

  await expectScreenshotsToMatchSnapshots({
    clearNotifications: true,
    headless,
    screenshotTarget: page,
    snapshotName: "hidden-page",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="You found the secret of the project 331!"`),
    ],
  })
})
