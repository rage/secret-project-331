import { BrowserContext, expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

import { fillPeerReview, TIMEOUT } from "./peer_review_utils"

test.describe.only("test ManualReviewEverything behavior", () => {
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

  test("ManualReviewEverything > Single submissions", async ({ headless }, testInfo) => {
    test.slow()
    const student1Page = await context1.newPage()
    const student2Page = await context2.newPage()
    const teacherPage = await context3.newPage()

    // Student 1 submits an answer
    await student1Page.goto("http://project-331.local/")
    await student1Page
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(student1Page).toHaveURL("http://project-331.local/org/uh-cs")
    await student1Page
      .getByRole("link", { name: "Navigate to course 'Peer review Course'" })
      .click()
    await expect(student1Page).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course",
    )
    await selectCourseInstanceIfPrompted(student1Page)
    await student1Page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await expect(student1Page).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1",
    )
    await student1Page.getByRole("link", { name: "1 Page One" }).click()
    await expect(student1Page).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-1",
    )
    await student1Page.frameLocator("iframe").getByRole("checkbox", { name: "a" }).click()
    await student1Page.getByRole("button", { name: "Submit" }).click()
    await student1Page.getByText("Try again").waitFor()

    // Student 2 submits an answer
    await student2Page.goto("http://project-331.local/")
    await student2Page
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(student2Page).toHaveURL("http://project-331.local/org/uh-cs")
    await student2Page
      .getByRole("link", { name: "Navigate to course 'Peer review Course'" })
      .click()
    await expect(student2Page).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course",
    )
    await selectCourseInstanceIfPrompted(student2Page)
    await student2Page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await expect(student2Page).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1",
    )
    await student2Page.getByRole("link", { name: "1 Page One" }).click()
    await expect(student2Page).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-1",
    )
    await student2Page.frameLocator("iframe").getByRole("checkbox", { name: "b" }).click()
    await student2Page.getByRole("button", { name: "Submit" }).click()
    await student2Page.getByText("Try again").waitFor()

    await student1Page
      .frameLocator("iframe")
      .first()
      .locator("div#exercise-service-content-id")
      .click({ timeout: TIMEOUT })

    // Student 1 starts peer review
    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-1-before-filling-peer-review-single-submission",
      screenshotTarget: student1Page,
      clearNotifications: true,
      waitForTheseToBeVisibleAndStable: [student1Page.locator('text="ManualReviewEverything"')],
      scrollToYCoordinate: 0,
      screenshotOptions: { fullPage: true },
    })

    await fillPeerReview(student1Page, ["Agree", "Agree"])

    await student1Page
      .frameLocator("iframe")
      .first()
      .locator("div#exercise-service-content-id")
      .click({ timeout: TIMEOUT })

    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-1-after-filling-peer-review-single-submission",
      screenshotTarget: student1Page,
      clearNotifications: true,
      waitForTheseToBeVisibleAndStable: [student1Page.locator('text="ManualReviewEverything"')],
      scrollToYCoordinate: 0,
      screenshotOptions: { fullPage: true },
    })

    await student2Page
      .frameLocator("iframe")
      .first()
      .locator("div#exercise-service-content-id")
      .click({ timeout: TIMEOUT })

    // Student 2 starts peer review
    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-2-before-filling-peer-review-single-submission",
      screenshotTarget: student2Page,
      clearNotifications: true,
      waitForTheseToBeVisibleAndStable: [student2Page.locator('text="ManualReviewEverything"')],
      scrollToYCoordinate: 0,
      screenshotOptions: { fullPage: true },
    })
    await fillPeerReview(student2Page, ["Disagree", "Disagree"])

    await student2Page
      .frameLocator("iframe")
      .first()
      .locator("div#exercise-service-content-id")
      .click({ timeout: TIMEOUT })

    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-2-after-filling-peer-review-single-submission",
      screenshotTarget: student2Page,
      clearNotifications: true,
      waitForTheseToBeVisibleAndStable: [student2Page.locator('text="ManualReviewEverything"')],
      scrollToYCoordinate: 0,
      screenshotOptions: { fullPage: true },
    })

    // Teacher checks answers requiring attention
    await teacherPage.goto("http://project-331.local/")
    await teacherPage.waitForTimeout(1000)
    await teacherPage
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(teacherPage).toHaveURL("http://project-331.local/org/uh-cs")
    await teacherPage.getByRole("link", { name: "Manage course 'Peer review Course'" }).click()
    await teacherPage.getByRole("tab", { name: "Exercises" }).click()
    await teacherPage.getByText("ManualReviewEverything 2View answers requiring attention").click()

    await teacherPage.getByRole("button", { name: "Zero points" }).first().click()
    await teacherPage.reload()

    await teacherPage.getByRole("button", { name: "Full points" }).first().click()
    await teacherPage.reload()

    await student1Page
      .frameLocator("iframe")
      .first()
      .locator("div#exercise-service-content-id")
      .click({ timeout: TIMEOUT })

    // Student 1 views his reviews and grading
    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-1-checking-their-peer-reviews-single-submission",
      screenshotTarget: student1Page,
      axeSkip: ["heading-order", "duplicate-id"],
      clearNotifications: true,
      waitForTheseToBeVisibleAndStable: [student1Page.locator('text="ManualReviewEverything"')],
      scrollToYCoordinate: 0,
      screenshotOptions: { fullPage: true },
    })

    await student2Page
      .frameLocator("iframe")
      .first()
      .locator("div#exercise-service-content-id")
      .click({ timeout: TIMEOUT })

    // Student 2 views his reviews and grading
    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-2-checking-their-peer-reviews-single-submission",
      screenshotTarget: student2Page,
      axeSkip: ["heading-order", "duplicate-id"],
      clearNotifications: true,
      waitForTheseToBeVisibleAndStable: [student1Page.locator('text="ManualReviewEverything"')],
      scrollToYCoordinate: 0,
      screenshotOptions: { fullPage: true },
    })
  })

  test("ManualReviewEverything > Multiple submissions", async ({ headless }, testInfo) => {
    test.slow()
    const student1Page = await context1.newPage()
    const student2Page = await context2.newPage()
    const teacherPage = await context3.newPage()

    // student 1 submits an answer
    await student1Page.goto("http://project-331.local/")
    await student1Page
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(student1Page).toHaveURL("http://project-331.local/org/uh-cs")
    await student1Page
      .getByRole("link", { name: "Navigate to course 'Peer review Course'" })
      .click()
    await expect(student1Page).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course",
    )
    await selectCourseInstanceIfPrompted(student1Page)
    await student1Page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await expect(student1Page).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1",
    )
    await student1Page.getByRole("link", { name: "4 Page Four" }).click()
    await expect(student1Page).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-4",
    )
    await student1Page.frameLocator("iframe").getByRole("checkbox", { name: "a" }).click()
    await student1Page.getByRole("button", { name: "Submit" }).click()
    await student1Page.getByText("Try again").waitFor()

    await student1Page.getByRole("button", { name: "try again" }).click()
    await student1Page.frameLocator("iframe").getByRole("checkbox", { name: "a" }).click()
    await student1Page.getByRole("button", { name: "Submit" }).click()
    await student1Page.getByText("Try again").waitFor()

    // student 2 submits an answer
    await student2Page.goto("http://project-331.local/")
    await student2Page
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(student2Page).toHaveURL("http://project-331.local/org/uh-cs")
    await student2Page
      .getByRole("link", { name: "Navigate to course 'Peer review Course'" })
      .click()
    await expect(student2Page).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course",
    )
    await selectCourseInstanceIfPrompted(student2Page)
    await student2Page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await expect(student2Page).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1",
    )
    await student2Page.getByRole("link", { name: "4 Page Four" }).click()
    await expect(student2Page).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-4",
    )
    await student2Page.frameLocator("iframe").getByRole("checkbox", { name: "b" }).click()
    await student2Page.getByRole("button", { name: "Submit" }).click()
    await student2Page.getByText("Try again").waitFor()

    await student2Page
      .frameLocator("iframe")
      .first()
      .locator("div#exercise-service-content-id")
      .click({ timeout: TIMEOUT })

    // student 2 starts a peer review
    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-2-before-filling-peer-review-1-multiple-submission",
      screenshotTarget: student2Page,
      clearNotifications: true,
      waitForTheseToBeVisibleAndStable: [student2Page.locator('text="ManualReviewEverything2"')],
      screenshotOptions: { fullPage: true },
    })

    await fillPeerReview(student2Page, ["Disagree", "Disagree"])

    await student2Page
      .frameLocator("iframe")
      .first()
      .locator("div#exercise-service-content-id")
      .click({ timeout: TIMEOUT })

    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-2-after-filling-peer-review-1-multiple-submission",
      screenshotTarget: student2Page,
      clearNotifications: true,
      waitForTheseToBeVisibleAndStable: [student2Page.locator('text="ManualReviewEverything2"')],
      screenshotOptions: { fullPage: true },
    })

    await student1Page
      .frameLocator("iframe")
      .first()
      .locator("div#exercise-service-content-id")
      .click({ timeout: TIMEOUT })

    // student 1 starts a peer review
    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-1-before-filling-peer-review-multiple-submission",
      screenshotTarget: student2Page,
      clearNotifications: true,
      waitForTheseToBeVisibleAndStable: [student2Page.locator('text="ManualReviewEverything2"')],
      screenshotOptions: { fullPage: true },
    })
    await fillPeerReview(student1Page, ["Agree", "Agree"])
    await student1Page
      .frameLocator("iframe")
      .first()
      .locator("div#exercise-service-content-id")
      .click({ timeout: TIMEOUT })

    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-1-after-filling-peer-review-multiple-submission",
      screenshotTarget: student1Page,
      clearNotifications: true,
      waitForTheseToBeVisibleAndStable: [student1Page.locator('text="ManualReviewEverything2"')],
      screenshotOptions: { fullPage: true },
    })

    // teacher checks the answers
    await teacherPage.goto("http://project-331.local/")
    await teacherPage.waitForTimeout(1000)
    await teacherPage
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(teacherPage).toHaveURL("http://project-331.local/org/uh-cs")
    await teacherPage.getByRole("link", { name: "Manage course 'Peer review Course'" }).click()
    await teacherPage.getByRole("tab", { name: "Exercises" }).click()
    await teacherPage.getByText("ManualReviewEverything2 3View answers requiring attention").click()

    await teacherPage.getByRole("button", { name: "Zero points" }).first().click()
    await teacherPage.reload()

    await teacherPage.getByRole("button", { name: "Full points" }).first().click()
    await teacherPage.reload()

    // Student 1 seeing the score

    await student1Page
      .frameLocator("iframe")
      .first()
      .locator("div#exercise-service-content-id")
      .click({ timeout: TIMEOUT })

    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-1-checking-their-peer-reviews-multiple-submission",
      screenshotTarget: student1Page,
      axeSkip: ["heading-order", "duplicate-id"],
      clearNotifications: true,
      waitForTheseToBeVisibleAndStable: [student1Page.locator('text="ManualReviewEverything2"')],
      screenshotOptions: { fullPage: true },
    })

    // Student 2 seeing the score
    await student2Page
      .frameLocator("iframe")
      .first()
      .locator("div#exercise-service-content-id")
      .click({ timeout: TIMEOUT })

    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "student-2-checking-their-peer-reviews-multiple-submission",
      screenshotTarget: student2Page,
      axeSkip: ["heading-order", "duplicate-id"],
      clearNotifications: true,
      waitForTheseToBeVisibleAndStable: [student2Page.locator('text="ManualReviewEverything2"')],
      screenshotOptions: { fullPage: true },
    })

    // Check exercise status summary
    await teacherPage.goto("http://project-331.local/org/uh-cs")
    await teacherPage.getByRole("link", { name: "Manage course 'Peer review Course'" }).click()
    await teacherPage.getByRole("tab", { name: "Course instances" }).click()
    await teacherPage
      .getByRole("listitem")
      .filter({
        hasText: "Default",
        hasNotText: "Non-default instance",
      })
      .getByRole("link", { name: "View points" })
      .click()
    await teacherPage.getByText("d7d6246c-45a8-4ff4-bf4d-31dedfaac159").click()
    await teacherPage.getByText(`Exercise: ManualReviewEverything2 (1 submissions)`).waitFor()
    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      snapshotName: "exercise-status-summary",
      screenshotTarget: teacherPage,
      clearNotifications: true,
    })
  })
})
