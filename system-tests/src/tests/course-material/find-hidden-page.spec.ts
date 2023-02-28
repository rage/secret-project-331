import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("find hidden page", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])

  // Click text=Introduction to everything
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-everything' }*/),
    page.click("text=Introduction to everything"),
  ])

  await selectCourseInstanceIfPrompted(page)

  await page.getByText("Information pages").waitFor()
  await page.waitForTimeout(200)

  await expectScreenshotsToMatchSnapshots({
    beforeScreenshot: async () => {
      await page.locator("text=Information pages").scrollIntoViewIfNeeded()
      await page.waitForTimeout(800)
    },
    clearNotifications: true,
    headless,
    page,
    snapshotName: "top-level-pages-list",
  })

  // Click text=Welcome to Introduction to Everything
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-everything/welcome' }*/),
    page.click("text=Welcome to Introduction to Everything"),
  ])

  await page.goto("http://project-331.local/org/uh-cs/courses/introduction-to-everything/hidden")

  await expectScreenshotsToMatchSnapshots({
    clearNotifications: true,
    headless,
    page,
    snapshotName: "hidden-page",
    waitForThisToBeVisibleAndStable: [`text="You found the secret of the project 331!"`],
  })
})
