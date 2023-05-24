import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("find hidden page", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])

  await page.locator("text=Introduction to everything").click()

  await selectCourseInstanceIfPrompted(page)

  await expectScreenshotsToMatchSnapshots({
    clearNotifications: true,
    headless,
    testInfo,
    screenshotTarget: page,
    snapshotName: "top-level-pages-list",
    screenshotOptions: { maxDiffPixels: 1000 },
    scrollToYCoordinate: { "mobile-tall": 5061, "desktop-regular": 3661 },
    beforeScreenshot: async () => {
      await Promise.all([
        page.getByText("Information pages").waitFor(),
        // eslint-disable-next-line playwright/no-wait-for-timeout
        page.waitForTimeout(200),
        page.getByText("Chapter 7Bonus chapterChapter 8Another bonus chapter").click(),
      ])
    },
  })

  await page.locator("text=Welcome to Introduction to Everything").click()

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
    screenshotOptions: { maxDiffPixels: 400 },
  })
})
