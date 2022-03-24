import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/user@example.com.json",
})
test("test", async ({ page, headless }) => {
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
    page.locator("text=Advanced course instance managementNo description available").click(),
  ])
  // Click text=Default >> nth=0
  await page.locator("text=Default").first().click()
  // Click button:has-text("Continue")
  await page.locator('button:has-text("Continue")').click()
  // Click text=The Basics
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/advanced-course-instance-management/chapter-1' }*/),
    page.locator("text=The Basics").click(),
  ])
  // Click text=Page 7 >> nth=0
  await page.locator("text=Page 7").first().click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/advanced-course-instance-management/chapter-1/page-7",
  )

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe")
    }),
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-material-multiple-choice-before-success-click-column-single",
    waitForThisToBeVisibleAndStable: `text="This is first option"`,
    frame,
  })
  // Click button[role="radio"]:has-text("This is first option")
  await page
    .frameLocator("iframe")
    .locator('button[role="radio"]:has-text("This is first option")')
    .click()

  // Click text=Submit
  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-material-multiple-choice-after-success-click-column-single",
    waitForThisToBeVisibleAndStable: `text="Correct! This is indeed the first answer"`,
    frame,
  })

  // Click text=try again
  await page.locator("text=try again").click()
  // Click button[role="radio"]:has-text("This is second option")

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["color-contrast"],
    headless,
    snapshotName: "course-material-multiple-choice-before-failure-click-column-single",
    waitForThisToBeVisibleAndStable: `text="This is second option"`,
    frame,
  })

  await page
    .frameLocator("iframe")
    .locator('button[role="radio"]:has-text("This is second option")')
    .click()
  // Click text=Submit
  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-material-multiple-choice-after-failure-click-column-single",
    waitForThisToBeVisibleAndStable: `text="Incorrect. This is not the first answer"`,
    frame,
  })

  // Click text=Page 8
  await page.locator("text=Page 8").click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/advanced-course-instance-management/chapter-1/page-8",
  )

  const frame2 = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe")
    }),
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-material-multiple-choice-before-success-click-column-multi",
    waitForThisToBeVisibleAndStable: `text="This is first option"`,
    frame: frame2,
  })
  // Click button[role="radio"]:has-text("This is first option")
  await page
    .frameLocator("iframe")
    .locator('button[role="radio"]:has-text("This is first option")')
    .click()

  // Click text=Submit
  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-material-multiple-choice-after-success-click-column-multi",
    waitForThisToBeVisibleAndStable: `text="Correct! This is indeed the first answer"`,
    frame: frame2,
  })

  // Click text=try again
  await page.locator("text=try again").click()
  // Click button[role="radio"]:has-text("This is second option")

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["color-contrast"],
    headless,
    snapshotName: "course-material-multiple-choice-before-failure-click-column-multi",
    waitForThisToBeVisibleAndStable: `text="This is second option"`,
    frame: frame2,
  })

  await page
    .frameLocator("iframe")
    .locator('button[role="radio"]:has-text("This is second option")')
    .click()
  // Click text=Submit
  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "course-material-multiple-choice-after-failure-click-column-multi",
    waitForThisToBeVisibleAndStable: `text="Incorrect. This is not the first answer"`,
    frame: frame2,
  })
})
