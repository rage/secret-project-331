import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

const FIRST_TASK = `[title="Exercise 1, task 0 content"]`
const SECOND_TASK = `[title="Exercise 1, task 1 content"]`
const THIRD_TASK = `[title="Exercise 1, task 2 content"]`
const CORRECT = `button:has-text("Correct") >> nth=0`
const INCORRECT = `button:has-text("Incorrect")`

test("Exercise score updates gradually", async ({ headless, page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  // Click text=Advanced exercise states
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/advanced-exercise-states' }*/),
    page.click("text=Advanced exercise states"),
  ])

  // Click text=Default
  await page.click("text=Default")
  // Click button:has-text("Continue")
  await selectCourseInstanceIfPrompted(page)

  // Click #content a >> :nth-match(div:has-text("CHAPTER 1The Basics"), 3)
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/johdatus-lokalisointiin/chapter-1' }*/),
    page.click('#content a >> :nth-match(div:has-text("CHAPTER 1The Basics"), 3)'),
  ])

  // Click text=Complicated exercise page >> nth=0
  await Promise.all([page.waitForNavigation(), page.click("text=Complicated exercise page")])
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/advanced-exercise-states/chapter-1/complicated-exercise",
  )

  await page.locator(FIRST_TASK).scrollIntoViewIfNeeded()
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "exercise-before-answering",
    waitForThisToBeVisibleAndStable: [
      `text=First question.`,
      `text=Second question.`,
      `text=Third question.`,
    ],
    toMatchSnapshotOptions: { threshold: 0.4 },
    elementId: "#c1d545d7-c46b-5076-8f34-32374dd03310",
  })

  await page.locator(FIRST_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(FIRST_TASK).locator(CORRECT).click()
  await page.locator(SECOND_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(SECOND_TASK).locator(CORRECT).click()
  await page.locator(THIRD_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(THIRD_TASK).locator(INCORRECT).click()
  await page.click("text=Submit")

  await page.locator(FIRST_TASK).scrollIntoViewIfNeeded()
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "two-out-of-three",
    waitForThisToBeVisibleAndStable: [
      `text=First question.`,
      `text=Second question.`,
      `text=Third question.`,
    ],
    toMatchSnapshotOptions: { threshold: 0.4 },
    elementId: "#c1d545d7-c46b-5076-8f34-32374dd03310",
  })

  await page.click("text=try again")
  await page.locator(FIRST_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(FIRST_TASK).locator(INCORRECT).click()
  await page.locator(SECOND_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(SECOND_TASK).locator(INCORRECT).click()
  await page.locator(THIRD_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(THIRD_TASK).locator(CORRECT).click()
  await page.click("text=Submit")

  await page.locator(FIRST_TASK).scrollIntoViewIfNeeded()
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "only-third-correct-score-stays-same",
    waitForThisToBeVisibleAndStable: [
      `text=First question.`,
      `text=Second question.`,
      `text=Third question.`,
    ],
    toMatchSnapshotOptions: { threshold: 0.4 },
    elementId: "#c1d545d7-c46b-5076-8f34-32374dd03310",
  })

  await page.click("text=try again")
  await page.locator(FIRST_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(FIRST_TASK).locator(CORRECT).click()
  await page.locator(SECOND_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(SECOND_TASK).locator(CORRECT).click()
  await page.locator(THIRD_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(THIRD_TASK).locator(CORRECT).click()
  await page.click("text=Submit")

  await page.locator(FIRST_TASK).scrollIntoViewIfNeeded()
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "correct-answer",
    waitForThisToBeVisibleAndStable: [
      `text=First question.`,
      `text=Second question.`,
      `text=Third question.`,
    ],
    toMatchSnapshotOptions: { threshold: 0.4 },
    elementId: "#c1d545d7-c46b-5076-8f34-32374dd03310",
  })
})
