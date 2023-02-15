import { BrowserContext, expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

import { fillPeerReview } from "./peer_review_utils"

test.describe("test ManualReviewEverything behavior", () => {
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

  test("ManualReviewEverything > Single submissions", async ({ headless }) => {
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

    // Student 1 starts peer review
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-before-filling-peer-review-single-submission",
      page: student1Page,
      clearNotifications: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything"'],
      scrollToYCoordinate: 0,
      pageScreenshotOptions: { fullPage: true },
    })
    await fillPeerReview(student1Page, ["Agree", "Agree"])
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-after-filling-peer-review-single-submission",
      page: student1Page,
      clearNotifications: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything"'],
      scrollToYCoordinate: 0,
      pageScreenshotOptions: { fullPage: true },
    })

    // Student 2 starts peer review
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-before-filling-peer-review-single-submission",
      page: student2Page,
      clearNotifications: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything"'],
      scrollToYCoordinate: 0,
      pageScreenshotOptions: { fullPage: true },
    })
    await fillPeerReview(student2Page, ["Disagree", "Disagree"])
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-after-filling-peer-review-single-submission",
      page: student2Page,
      clearNotifications: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything"'],
      scrollToYCoordinate: 0,
      pageScreenshotOptions: { fullPage: true },
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

    // Student 1 views his reviews and grading
    await student1Page.reload()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-checking-their-peer-reviews-single-submission",
      page: student1Page,
      axeSkip: ["heading-order", "duplicate-id"],
      clearNotifications: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything"'],
      scrollToYCoordinate: 0,
      pageScreenshotOptions: { fullPage: true },
    })

    // Student 2 views his reviews and grading
    await student2Page.reload()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-checking-their-peer-reviews-single-submission",
      page: student2Page,
      axeSkip: ["heading-order", "duplicate-id"],
      clearNotifications: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything"'],
      scrollToYCoordinate: 0,
      pageScreenshotOptions: { fullPage: true },
    })
  })

  test("ManualReviewEverything > Multiple submissions", async ({ headless }) => {
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

    await student1Page.getByRole("button", { name: "try again" }).click()
    await student1Page.frameLocator("iframe").getByRole("checkbox", { name: "a" }).click()
    await student1Page.getByRole("button", { name: "Submit" }).click()

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

    // student 2 starts a peer review
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-before-filling-peer-review-1-multiple-submission",
      page: student2Page,
      clearNotifications: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything2"'],
      pageScreenshotOptions: { fullPage: true },
    })

    await fillPeerReview(student2Page, ["Disagree", "Disagree"])

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-after-filling-peer-review-1-multiple-submission",
      page: student2Page,
      clearNotifications: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything2"'],
      pageScreenshotOptions: { fullPage: true },
    })

    // student 1 starts a peer review
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-before-filling-peer-review-multiple-submission",
      page: student1Page,
      clearNotifications: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything2"'],
      pageScreenshotOptions: { fullPage: true },
    })
    await fillPeerReview(student1Page, ["Agree", "Agree"])
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-after-filling-peer-review-multiple-submission",
      page: student1Page,
      clearNotifications: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything2"'],
      pageScreenshotOptions: { fullPage: true },
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
    await student1Page.reload()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-checking-their-peer-reviews-multiple-submission",
      page: student1Page,
      axeSkip: ["heading-order", "duplicate-id"],
      clearNotifications: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything2"'],
      pageScreenshotOptions: { fullPage: true },
    })

    // Student 2 seeing the score
    await student2Page.reload()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-checking-their-peer-reviews-multiple-submission",
      page: student2Page,
      axeSkip: ["heading-order", "duplicate-id"],
      clearNotifications: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything2"'],
      pageScreenshotOptions: { fullPage: true },
    })
  })
})
