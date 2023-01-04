import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})
test("multiple-choice course material row test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  // Click text=Advanced course instance managementNo description available
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/advanced-course-instance-management' }*/),
    page.locator(`div:text-is("Introduction to Course Material")`).click(),
  ])
  await selectCourseInstanceIfPrompted(page)
  await page.locator("text=User Experience").click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-2",
  )

  await page.evaluate(() => {
    window.scrollBy(0, 500)
  })
  // Click text=Page 8
  await page.locator(`a:has-text("Page 5")`).first().click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-2/page-5",
  )

  const frame3 = getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-material-multiple-choice-before-success-click-row-single",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="This is first option"`)],
    screenshotTarget: frame3,
    clearNotifications: true,
  })
  // Click button:has-text("This is first option")
  await page.frameLocator("iframe").locator('button:has-text("This is first option")').click()

  // Click text=Submit
  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["color-contrast"],
    headless,
    snapshotName: "course-material-multiple-choice-after-success-click-row-single",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Correct! This is indeed the first answer"`),
    ],
    screenshotTarget: frame3,
    clearNotifications: true,
  })

  // Click text=try again
  await page.locator("text=try again").click()
  // Click button:has-text("This is second option")

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["color-contrast"],
    headless,
    snapshotName: "course-material-multiple-choice-before-failure-click-row-single",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="This is second option"`)],
    screenshotTarget: frame3,
    clearNotifications: true,
  })

  await page.frameLocator("iframe").locator('button:has-text("This is second option")').click()
  // Click text=Submit
  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-material-multiple-choice-after-failure-click-row-single",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Incorrect. This is not the first answer"`),
    ],
    screenshotTarget: frame3,
    clearNotifications: true,
  })

  // Click text=Page 6
  await page.locator(`a:has-text("Page 6")`).click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-2/page-6",
  )

  const frame4 = getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-material-multiple-choice-before-success-click-row-multi",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="This is first option"`)],
    screenshotTarget: frame4,
    clearNotifications: true,
  })
  // Click button:has-text("This is first option")
  await page.frameLocator("iframe").locator('button:has-text("This is first option")').click()

  // Click text=Submit
  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["color-contrast"],
    headless,
    snapshotName: "course-material-multiple-choice-after-success-click-row-multi",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Correct! This is indeed the first answer"`),
    ],
    screenshotTarget: frame4,
    clearNotifications: true,
  })

  // Click text=try again
  await page.locator("text=try again").click()
  // Click button:has-text("This is second option")

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["color-contrast"],
    headless,
    snapshotName: "course-material-multiple-choice-before-failure-click-row-multi",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="This is second option"`)],
    screenshotTarget: frame4,
    clearNotifications: true,
  })

  await page.frameLocator("iframe").locator('button:has-text("This is second option")').click()
  // Click text=Submit
  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-material-multiple-choice-after-failure-click-row-multi",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Incorrect. This is not the first answer"`),
    ],
    screenshotTarget: frame4,
    clearNotifications: true,
  })
})
