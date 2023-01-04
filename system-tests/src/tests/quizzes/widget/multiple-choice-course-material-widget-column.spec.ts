import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})
test("multiple-choice course material column test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  // Click text=Introduction to Course Material
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/advanced-course-instance-management' }*/),
    page.locator(`div:text-is("Introduction to Course Material")`).click(),
  ])
  await selectCourseInstanceIfPrompted(page)

  await page.evaluate(() => {
    window.scrollBy(0, 1800)
  })
  // Click text=Chapter 2: User Experience
  await page.locator("text=User Experience").click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-2",
  )
  await page.evaluate(() => {
    window.scrollBy(0, 500)
  })
  // Click text=Page 3 >> nth=0
  await page.locator(`a:has-text("Page 3")`).first().click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-2/page-3",
  )

  const frame = getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-material-multiple-choice-before-success-click-column-single",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="This is first option"`)],
    screenshotTarget: frame,
    clearNotifications: true,
  })
  // Click button:has-text("This is first option")
  await page.frameLocator("iframe").locator('button:has-text("This is first option")').click()

  // Click text=Submit
  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-material-multiple-choice-after-success-click-column-single",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Correct! This is indeed the first answer"`),
    ],
    screenshotTarget: frame,
    clearNotifications: true,
  })

  // Click text=try again
  await page.locator("text=try again").click()
  // Click button:has-text("This is second option")

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["color-contrast"],
    headless,
    snapshotName: "course-material-multiple-choice-before-failure-click-column-single",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="This is second option"`)],

    screenshotTarget: frame,
    clearNotifications: true,
  })

  await page.frameLocator("iframe").locator('button:has-text("This is second option")').click()
  // Click text=Submit
  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-material-multiple-choice-after-failure-click-column-single",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Incorrect. This is not the first answer"`),
    ],

    screenshotTarget: frame,
    clearNotifications: true,
  })

  // Click text=Page 4
  await page.locator(`a:has-text("Page 4")`).click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-2/page-4",
  )

  const frame2 = getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-material-multiple-choice-before-success-click-column-multi",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="This is first option"`)],

    screenshotTarget: frame2,
    clearNotifications: true,
  })
  // Click button:has-text("This is first option")
  await page.frameLocator("iframe").locator('button:has-text("This is first option")').click()

  // Click text=Submit
  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["color-contrast"],
    headless,
    snapshotName: "course-material-multiple-choice-after-success-click-column-multi",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Correct! This is indeed the first option"`),
    ],
    screenshotTarget: frame2,
    clearNotifications: true,
  })

  // Click text=try again
  await page.locator("text=try again").click()
  // Click button:has-text("This is second option")

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["color-contrast"],
    headless,
    snapshotName: "course-material-multiple-choice-before-failure-click-column-multi",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="This is second option"`)],
    screenshotTarget: frame2,
    clearNotifications: true,
  })

  await page.frameLocator("iframe").locator('button:has-text("This is second option")').click()
  // Click text=Submit
  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-material-multiple-choice-after-failure-click-column-multi",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Incorrect. This is not the first option"`),
    ],
    screenshotTarget: frame2,
    clearNotifications: true,
  })
})
