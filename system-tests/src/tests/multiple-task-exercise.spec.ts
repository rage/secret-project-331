import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

const FIRST_TASK = `[title="Exercise 1, task 1 content"]`
const SECOND_TASK = `[title="Exercise 1, task 2 content"]`
const THIRD_TASK = `[title="Exercise 1, task 3 content"]`
const CORRECT = `button:has-text("Correct") >> nth=0`
const INCORRECT = `button:has-text("Incorrect")`

test("Exercise score updates gradually", async ({ headless, page }) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/advanced-exercise-states' }*/),
    page.locator("text=Advanced exercise states").click(),
  ])

  await selectCourseInstanceIfPrompted(page)

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/johdatus-lokalisointiin/chapter-1' }*/),
    page.click('#content a >> :nth-match(div:has-text("CHAPTER 1The Basics"), 3)'),
  ])

  await Promise.all([
    page.waitForNavigation(),
    page.locator("text=Complicated exercise page").click(),
  ])
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/advanced-exercise-states/chapter-1/complicated-exercise",
  )

  await page.locator(FIRST_TASK).scrollIntoViewIfNeeded()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page.locator("id=c1d545d7-c46b-5076-8f34-32374dd03310"),
    headless,
    snapshotName: "exercise-before-answering",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=First question.`),
      page.locator(`text=Second question.`),
      page.locator(`text=Third question.`),
    ],
  })

  await page.locator(FIRST_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(FIRST_TASK).locator(CORRECT).click()
  await page.locator(SECOND_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(SECOND_TASK).locator(CORRECT).click()
  await page.locator(THIRD_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(THIRD_TASK).locator(INCORRECT).click()
  await page.locator('button:has-text("Submit")').click()

  await page.locator(FIRST_TASK).scrollIntoViewIfNeeded()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page.locator("id=c1d545d7-c46b-5076-8f34-32374dd03310"),
    headless,
    snapshotName: "two-out-of-three",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=First question.`),
      page.locator(`text=Second question.`),
      page.locator(`text=Third question.`),
    ],
  })

  await page.locator('button:has-text("try again")').click()
  await page.locator(FIRST_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(FIRST_TASK).locator(INCORRECT).click()
  await page.locator(SECOND_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(SECOND_TASK).locator(INCORRECT).click()
  await page.locator(THIRD_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(THIRD_TASK).locator(CORRECT).click()
  await page.locator('button:has-text("Submit")').click()

  await page.locator(FIRST_TASK).scrollIntoViewIfNeeded()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page.locator("id=c1d545d7-c46b-5076-8f34-32374dd03310"),
    headless,
    snapshotName: "only-third-correct-score-stays-same",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=First question.`),
      page.locator(`text=Second question.`),
      page.locator(`text=Third question.`),
      page.getByText("Your answer was not correct").first(),
    ],
  })

  await page.locator('button:has-text("try again")').click()
  await page.locator(FIRST_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(FIRST_TASK).locator(CORRECT).click()
  await page.locator(SECOND_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(SECOND_TASK).locator(CORRECT).click()
  await page.locator(THIRD_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(THIRD_TASK).locator(CORRECT).click()
  await page.locator('button:has-text("Submit")').click()

  await page.locator(FIRST_TASK).scrollIntoViewIfNeeded()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page.locator("id=c1d545d7-c46b-5076-8f34-32374dd03310"),
    headless,
    snapshotName: "correct-answer",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=First question.`),
      page.locator(`text=Second question.`),
      page.locator(`text=Third question.`),
    ],
  })
})
