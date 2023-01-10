import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { login } from "../../utils/login"
import { logout } from "../../utils/logout"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

import { fillPeerReview } from "./peer_review_utils"

test.describe("test ManualReviewEverything behavior", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  test("ManualReviewEverything > Single submissions", async ({ headless, browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const context3 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    const page3 = await context3.newPage()

    await logout(page1)
    await logout(page2)
    await logout(page3)

    await login("student1@example.com", "student.1", page1, true)
    await login("student2@example.com", "student.2", page2, true)
    await login("teacher@example.com", "teacher", page3, true)

    // Student 1 submits an answer
    await page1.goto("http://project-331.local/")
    await page1
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(page1).toHaveURL("http://project-331.local/org/uh-cs")
    await page1.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await expect(page1).toHaveURL("http://project-331.local/org/uh-cs/courses/peer-review-course")
    await selectCourseInstanceIfPrompted(page1)
    await page1.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await expect(page1).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1",
    )
    await page1.getByRole("link", { name: "1 Page One" }).click()
    await expect(page1).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-1",
    )
    await page1.frameLocator("iframe").getByRole("checkbox", { name: "a" }).click()
    await page1.getByRole("button", { name: "Submit" }).click()

    // Student 2 submits an answer
    await page2.goto("http://project-331.local/")
    await page2
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(page2).toHaveURL("http://project-331.local/org/uh-cs")
    await page2.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await expect(page2).toHaveURL("http://project-331.local/org/uh-cs/courses/peer-review-course")
    await selectCourseInstanceIfPrompted(page2)
    await page2.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await expect(page2).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1",
    )
    await page2.getByRole("link", { name: "1 Page One" }).click()
    await expect(page2).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-1",
    )
    await page2.frameLocator("iframe").getByRole("checkbox", { name: "b" }).click()
    await page2.getByRole("button", { name: "Submit" }).click()

    // Student 1 starts peer review
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-before-filling-peer-review-single-submission",
      page: page1,
      clearNotifications: true,
      skipMobile: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything"'],
      beforeScreenshot: async () =>
        await page1.getByText("ManualReviewEverything").scrollIntoViewIfNeeded(),
    })
    await fillPeerReview(page1, ["Agree", "Agree"])
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-after-filling-peer-review-single-submission",
      page: page1,
      clearNotifications: true,
      skipMobile: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything"'],
      beforeScreenshot: async () =>
        await page1.getByText("ManualReviewEverything").scrollIntoViewIfNeeded(),
    })

    // Student 2 starts peer review
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-before-filling-peer-review-single-submission",
      page: page2,
      clearNotifications: true,
      skipMobile: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything"'],
      beforeScreenshot: async () =>
        await page2.getByText("ManualReviewEverything").scrollIntoViewIfNeeded(),
    })
    await fillPeerReview(page2, ["Disagree", "Disagree"])
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-after-filling-peer-review-single-submission",
      page: page2,
      clearNotifications: true,
      skipMobile: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything"'],
      beforeScreenshot: async () =>
        await page2.getByText("ManualReviewEverything").scrollIntoViewIfNeeded(),
    })

    // Teacher checks answers requiring attention
    await page3.goto("http://project-331.local/")
    await page3.waitForTimeout(1000)
    await page3
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(page3).toHaveURL("http://project-331.local/org/uh-cs")
    await page3.getByRole("link", { name: "Manage course 'Peer review Course'" }).click()
    await page3.getByRole("tab", { name: "Exercises" }).click()
    await page3.getByText("ManualReviewEverything 2View answers requiring attention").click()

    await page3.getByRole("button", { name: "Zero points" }).first().click()
    await page3.reload()

    await page3.getByRole("button", { name: "Full points" }).first().click()
    await page3.reload()

    // Student 1 views his reviews and grading
    await page1.reload()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-checking-their-peer-reviews-single-submission",
      page: page1,
      axeSkip: ["heading-order", "duplicate-id"],
      clearNotifications: true,
      skipMobile: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything"'],
      beforeScreenshot: async () =>
        await page1.getByText("ManualReviewEverything").scrollIntoViewIfNeeded(),
    })

    // Student 2 views his reviews and grading
    await page2.reload()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-checking-their-peer-reviews-single-submission",
      page: page2,
      axeSkip: ["heading-order", "duplicate-id"],
      clearNotifications: true,
      skipMobile: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything"'],
      beforeScreenshot: async () =>
        await page2.getByText("ManualReviewEverything").scrollIntoViewIfNeeded(),
    })
  })

  test("ManualReviewEverything > Multiple submissions", async ({ browser, headless }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const context3 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    const page3 = await context3.newPage()

    await logout(page1)
    await logout(page2)
    await logout(page3)

    await login("student1@example.com", "student.1", page1, true)
    await login("student2@example.com", "student.2", page2, true)
    await login("teacher@example.com", "teacher", page3, true)

    // student 1 submits an answer
    await page1.goto("http://project-331.local/")
    await page1
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(page1).toHaveURL("http://project-331.local/org/uh-cs")
    await page1.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await expect(page1).toHaveURL("http://project-331.local/org/uh-cs/courses/peer-review-course")
    await selectCourseInstanceIfPrompted(page1)
    await page1.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await expect(page1).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1",
    )
    await page1.getByRole("link", { name: "4 Page Four" }).click()
    await expect(page1).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-4",
    )
    await page1.frameLocator("iframe").getByRole("checkbox", { name: "a" }).click()
    await page1.getByRole("button", { name: "Submit" }).click()

    await page1.getByRole("button", { name: "try again" }).click()
    await page1.frameLocator("iframe").getByRole("checkbox", { name: "a" }).click()
    await page1.getByRole("button", { name: "Submit" }).click()

    // student 2 submits an answer
    await page2.goto("http://project-331.local/")
    await page2
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(page2).toHaveURL("http://project-331.local/org/uh-cs")
    await page2.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await expect(page2).toHaveURL("http://project-331.local/org/uh-cs/courses/peer-review-course")
    await selectCourseInstanceIfPrompted(page2)
    await page2.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await expect(page2).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1",
    )
    await page2.getByRole("link", { name: "4 Page Four" }).click()
    await expect(page2).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-4",
    )
    await page2.frameLocator("iframe").getByRole("checkbox", { name: "b" }).click()
    await page2.getByRole("button", { name: "Submit" }).click()

    // student 2 starts a peer review
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-before-filling-peer-review-1-multiple-submission",
      page: page2,
      clearNotifications: true,
      skipMobile: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything2"'],
      beforeScreenshot: async () =>
        await page2.getByText("ManualReviewEverything2").scrollIntoViewIfNeeded(),
    })
    await fillPeerReview(page2, ["Disagree", "Disagree"])
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-after-filling-peer-review-1-multiple-submission",
      page: page2,
      clearNotifications: true,
      skipMobile: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything2"'],
      beforeScreenshot: async () =>
        await page2.getByText("ManualReviewEverything2").scrollIntoViewIfNeeded(),
    })

    // student 1 starts a peer review
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-before-filling-peer-review-multiple-submission",
      page: page1,
      clearNotifications: true,
      skipMobile: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything2"'],
      beforeScreenshot: async () =>
        await page1.getByText("ManualReviewEverything2").scrollIntoViewIfNeeded(),
    })
    await fillPeerReview(page1, ["Agree", "Agree"])
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-after-filling-peer-review-multiple-submission",
      page: page1,
      clearNotifications: true,
      skipMobile: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything2"'],
      beforeScreenshot: async () =>
        await page1.getByText("ManualReviewEverything2").scrollIntoViewIfNeeded(),
    })

    // teacher checks the answers
    await page3.goto("http://project-331.local/")
    await page3.waitForTimeout(1000)
    await page3
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(page3).toHaveURL("http://project-331.local/org/uh-cs")
    await page3.getByRole("link", { name: "Manage course 'Peer review Course'" }).click()
    await page3.getByRole("tab", { name: "Exercises" }).click()
    await page3.getByText("ManualReviewEverything2 3View answers requiring attention").click()

    await page3.getByRole("button", { name: "Zero points" }).first().click()
    await page3.reload()

    await page3.getByRole("button", { name: "Full points" }).first().click()
    await page3.reload()

    // Student 1 seeing the score
    await page1.reload()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-checking-their-peer-reviews-multiple-submission",
      page: page1,
      axeSkip: ["heading-order", "duplicate-id"],
      clearNotifications: true,
      skipMobile: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything2"'],
      beforeScreenshot: async () =>
        await page1.getByText("ManualReviewEverything2").scrollIntoViewIfNeeded(),
    })

    // Student 2 seeing the score
    await page2.reload()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-checking-their-peer-reviews-multiple-submission",
      page: page2,
      axeSkip: ["heading-order", "duplicate-id"],
      clearNotifications: true,
      skipMobile: true,
      waitForThisToBeVisibleAndStable: ['text="ManualReviewEverything2"'],
      beforeScreenshot: async () =>
        await page2.getByText("ManualReviewEverything2").scrollIntoViewIfNeeded(),
    })
  })
})
