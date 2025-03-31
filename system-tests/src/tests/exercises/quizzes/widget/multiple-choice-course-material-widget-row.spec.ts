import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})
test("multiple-choice course material row test", async ({ page, headless }, testInfo) => {
  test.slow()
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.getByText("University of Helsinki, Department of Computer Science").click(),
  ])

  await page.locator(`div:text-is("Introduction to Course Material")`).click()
  await selectCourseInstanceIfPrompted(page)
  await page.getByText("User Experience").click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-2",
  )

  await page.evaluate(() => {
    window.scrollBy(0, 500)
  })

  await page.locator(`a:has-text("Page 5")`).first().click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-2/page-5",
  )

  const frame3 = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "course-material-multiple-choice-before-success-click-row-single",
    waitForTheseToBeVisibleAndStable: [frame3.locator(`text="This is first option"`)],
    screenshotTarget: frame3,
    clearNotifications: true,
  })

  await frame3.locator('button:has-text("This is first option")').click()

  await page.getByText("Submit").click()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["color-contrast"],
    headless,
    testInfo,
    snapshotName: "course-material-multiple-choice-after-success-click-row-single",
    waitForTheseToBeVisibleAndStable: [
      frame3.locator(`text="Correct! This is indeed the first answer."`),
    ],
    screenshotTarget: frame3,
    clearNotifications: true,
  })

  await page.getByText("try again").click()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["color-contrast"],
    headless,
    testInfo,
    snapshotName: "course-material-multiple-choice-before-failure-click-row-single",
    waitForTheseToBeVisibleAndStable: [frame3.locator(`text="This is second option"`)],
    screenshotTarget: frame3,
    clearNotifications: true,
  })

  await frame3.locator('button:has-text("This is second option")').click()

  await page.getByText("Submit").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "course-material-multiple-choice-after-failure-click-row-single",
    waitForTheseToBeVisibleAndStable: [
      frame3.getByText(`Incorrect. This is not the first answer.`),
    ],
    screenshotTarget: frame3,
    clearNotifications: true,
  })

  await page.locator(`a:has-text("Page 6")`).click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-2/page-6",
  )

  const frame4 = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "course-material-multiple-choice-before-success-click-row-multi",
    waitForTheseToBeVisibleAndStable: [frame4.locator(`text="This is first option"`)],
    screenshotTarget: frame4,
    clearNotifications: true,
  })

  await frame4.locator('button:has-text("This is first option")').click()

  await page.getByText("Submit").click()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["color-contrast"],
    headless,
    testInfo,
    snapshotName: "course-material-multiple-choice-after-success-click-row-multi",
    waitForTheseToBeVisibleAndStable: [
      frame4.locator(`text="Correct! This is indeed the first answer."`),
    ],
    screenshotTarget: frame4,
    clearNotifications: true,
  })

  await page.getByText("try again").click()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["color-contrast"],
    headless,
    testInfo,
    snapshotName: "course-material-multiple-choice-before-failure-click-row-multi",
    waitForTheseToBeVisibleAndStable: [frame4.locator(`text="This is second option"`)],
    screenshotTarget: frame4,
    clearNotifications: true,
  })

  await frame4.locator('button:has-text("This is second option")').click()

  await page.getByText("Submit").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "course-material-multiple-choice-after-failure-click-row-multi",
    waitForTheseToBeVisibleAndStable: [
      frame4.getByText(`Incorrect. This is not the first answer.`),
    ],
    screenshotTarget: frame4,
    clearNotifications: true,
  })
})
