import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

const FIRST_TASK = `[title="Exercise 1, task 1 content"]`
const SECOND_TASK = `[title="Exercise 1, task 2 content"]`
const THIRD_TASK = `[title="Exercise 1, task 3 content"]`
const CORRECT = `button:has-text("Correct") >> nth=0`
const INCORRECT = `button:has-text("Incorrect")`

test.use({
  storageState: "src/states/student1@example.com.json",
})

test("After submitting wrong answer can resubmit again changing only wrong answer", async ({
  page,
  headless,
}, testInfo) => {
  test.slow()
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])

  await page.locator("text=Advanced exercise states").click()

  await selectCourseInstanceIfPrompted(page)

  await Promise.all([
    page.click('#content a >> :nth-match(div:has-text("CHAPTER 1The Basics"), 3)'),
  ])

  await Promise.all([page.getByRole("link", { name: "11 Complicated exercise page" }).click()])
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/advanced-exercise-states/chapter-1/complicated-exercise",
  )

  await page.locator(FIRST_TASK).scrollIntoViewIfNeeded()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page.locator("id=c1d545d7-c46b-5076-8f34-32374dd03310"),
    headless,
    testInfo,
    snapshotName: "exercise-before-answering-resubmitting-test",
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
    testInfo,
    snapshotName: "two-out-of-three-resubmitting-test",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=First question.`),
      page.locator(`text=Second question.`),
      page.locator(`text=Third question.`),
    ],
  })

  await page.locator('button:has-text("try again")').click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page.locator("id=c1d545d7-c46b-5076-8f34-32374dd03310"),
    headless,
    testInfo,
    snapshotName: "before-retrying-third-question-resubmitting-test",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=First question.`),
      page.locator(`text=Second question.`),
      page.locator(`text=Third question.`),
    ],
  })

  await page.locator(THIRD_TASK).scrollIntoViewIfNeeded()
  await page.frameLocator(THIRD_TASK).locator(CORRECT).click()
  await page.locator('button:has-text("Submit")').click()

  await page.locator(FIRST_TASK).scrollIntoViewIfNeeded()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page.locator("id=c1d545d7-c46b-5076-8f34-32374dd03310"),
    headless,
    testInfo,
    snapshotName: "only-third-correct-score-stays-same-resubmitting-test",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=First question.`),
      page.locator(`text=Second question.`),
      page.locator(`text=Third question.`),
    ],
  })
})
