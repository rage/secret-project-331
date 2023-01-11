import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})
test("multiple-choice course material column test", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/advanced-course-instance-management' }*/),
    page.locator(`div:text-is("Introduction to Course Material")`).click(),
  ])
  await selectCourseInstanceIfPrompted(page)

  await page.evaluate(() => {
    window.scrollBy(0, 1800)
  })

  await page.locator("text=User Experience").click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-2",
  )
  await page.evaluate(() => {
    window.scrollBy(0, 500)
  })

  await page.locator(`a:has-text("Page 3")`).first().click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-2/page-3",
  )

  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "course-material-multiple-choice-before-success-click-column-single",
    waitForTheseToBeVisibleAndStable: [frame.locator(`text="This is first option"`)],
    screenshotTarget: frame,
    clearNotifications: true,
  })

  await frame.locator('button:has-text("This is first option")').click()

  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "course-material-multiple-choice-after-success-click-column-single",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Correct! This is indeed the first answer"`),
    ],
    screenshotTarget: frame,
    clearNotifications: true,
  })

  await page.locator("text=try again").click()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["color-contrast"],
    headless,
    testInfo,
    snapshotName: "course-material-multiple-choice-before-failure-click-column-single",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="This is second option"`)],

    screenshotTarget: frame,
    clearNotifications: true,
  })

  await page.frameLocator("iframe").locator('button:has-text("This is second option")').click()

  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "course-material-multiple-choice-after-failure-click-column-single",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Incorrect. This is not the first answer"`),
    ],

    screenshotTarget: frame,
    clearNotifications: true,
  })

  await page.locator(`a:has-text("Page 4")`).click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-2/page-4",
  )

  const frame2 = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "course-material-multiple-choice-before-success-click-column-multi",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="This is first option"`)],

    screenshotTarget: frame2,
    clearNotifications: true,
  })

  await page.frameLocator("iframe").locator('button:has-text("This is first option")').click()

  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["color-contrast"],
    headless,
    testInfo,
    snapshotName: "course-material-multiple-choice-after-success-click-column-multi",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Correct! This is indeed the first option"`),
    ],
    screenshotTarget: frame2,
    clearNotifications: true,
  })

  await page.locator("text=try again").click()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["color-contrast"],
    headless,
    testInfo,
    snapshotName: "course-material-multiple-choice-before-failure-click-column-multi",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="This is second option"`)],
    screenshotTarget: frame2,
    clearNotifications: true,
  })

  await page.frameLocator("iframe").locator('button:has-text("This is second option")').click()

  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "course-material-multiple-choice-after-failure-click-column-multi",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Incorrect. This is not the first option"`),
    ],
    screenshotTarget: frame2,
    clearNotifications: true,
  })
})
