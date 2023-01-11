import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("find hidden page", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-everything' }*/),
    page.locator("text=Introduction to everything").click(),
  ])

  await selectCourseInstanceIfPrompted(page)

  await expectScreenshotsToMatchSnapshots({
    beforeScreenshot: () => page.locator("text=Information pages").scrollIntoViewIfNeeded(),
    clearNotifications: true,
    headless,
    testInfo,
    screenshotTarget: page,
    snapshotName: "top-level-pages-list",
  })

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-everything/welcome' }*/),
    page.locator("text=Welcome to Introduction to Everything").click(),
  ])

  await page.goto("http://project-331.local/org/uh-cs/courses/introduction-to-everything/hidden")

  await expectScreenshotsToMatchSnapshots({
    clearNotifications: true,
    headless,
    testInfo,
    screenshotTarget: page,
    snapshotName: "hidden-page",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="You found the secret of the project 331!"`),
    ],
  })
})
