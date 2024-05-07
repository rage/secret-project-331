import { BrowserContext, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

import { answerExercise, fillPeerReview, TIMEOUT } from "./peer_review_utils"

const TEST_PAGE = "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-3"

test.describe("test AutomaticallyGradeByAverage behavior", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  let context1: BrowserContext
  let context2: BrowserContext
  let context3: BrowserContext

  test.beforeEach(async ({ browser }) => {
    context1 = await browser.newContext({ storageState: "src/states/student1@example.com.json" })
    context2 = await browser.newContext({ storageState: "src/states/student2@example.com.json" })
    context3 = await browser.newContext({ storageState: "src/states/teacher@example.com.json" })
  })

  test.afterEach(async () => {
    await context1.close()
    await context2.close()
    await context3.close()
  })

  test("AutomaticallyGradeByAverage > Accepts", async ({ headless }, testInfo) => {
    test.slow()
    const student1Page = await context1.newPage()
    const student2Page = await context2.newPage()
    const _teacherPage = await context3.newPage()

    // User 1 navigates to exercise and answers
    await answerExercise(student1Page, TEST_PAGE, "a")
    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-1-after-submission",
      screenshotTarget: student1Page,
      clearNotifications: true,
      waitForTheseToBeVisibleAndStable: [
        student1Page.locator('text="AutomaticallyGradeByAverage"'),
      ],
      scrollToYCoordinate: 0,
      screenshotOptions: { fullPage: true },
    })

    // User 2 navigates to exercise and answers
    await student2Page.goto("http://project-331.local/organizations")
    await answerExercise(student2Page, TEST_PAGE, "b")

    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-2-after-submission",
      screenshotTarget: student2Page,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      waitForTheseToBeVisibleAndStable: [
        student2Page.locator('text="AutomaticallyGradeByAverage"'),
      ],
      screenshotOptions: { fullPage: true },
    })

    // User 1 writes reviews
    await fillPeerReview(student1Page, ["Agree", "Agree"])

    // User 2 writes reviews
    await fillPeerReview(student2Page, ["Disagree", "Disagree"])

    await student1Page
      .frameLocator("iframe")
      .first()
      .locator("div#exercise-service-content-id")
      .click({ timeout: TIMEOUT })

    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-1-after-peer-review",
      screenshotTarget: student1Page,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      waitForTheseToBeVisibleAndStable: [
        student1Page.locator('text="AutomaticallyGradeByAverage"'),
      ],
      screenshotOptions: { fullPage: true },
    })

    await student2Page
      .frameLocator("iframe")
      .first()
      .locator("div#exercise-service-content-id")
      .click({ timeout: TIMEOUT })

    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-2-after-peer-review",
      screenshotTarget: student2Page,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      waitForTheseToBeVisibleAndStable: [
        student2Page.locator('text="AutomaticallyGradeByAverage"'),
      ],
      screenshotOptions: { fullPage: true },
    })

    await student1Page
      .frameLocator("iframe")
      .first()
      .locator("div#exercise-service-content-id")
      .click({ timeout: TIMEOUT })

    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-1-seeing-score",
      screenshotTarget: student1Page,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      waitForTheseToBeVisibleAndStable: [
        student1Page.locator('text="AutomaticallyGradeByAverage"'),
      ],
      screenshotOptions: { fullPage: true },
    })

    await student2Page
      .frameLocator("iframe")
      .first()
      .locator("div#exercise-service-content-id")
      .click({ timeout: TIMEOUT })

    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-2-seeing-score",
      screenshotTarget: student2Page,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      waitForTheseToBeVisibleAndStable: [
        student2Page.locator('text="AutomaticallyGradeByAverage"'),
      ],
      screenshotOptions: { fullPage: true },
    })
  })
})
