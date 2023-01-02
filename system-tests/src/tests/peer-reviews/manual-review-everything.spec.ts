import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { login } from "../../utils/login"
import { logout } from "../../utils/logout"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.describe("test ManualReviewEverything behavior", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  test("ManualReviewEverything > That gets a perfect score gets sent to manual review", async ({
    headless,
    browser,
  }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const context3 = await browser.newContext()
    const context4 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    const page3 = await context3.newPage()
    const page4 = await context4.newPage()

    await logout(page1)
    await logout(page2)
    await logout(page3)
    await logout(page4)

    await login("student1@example.com", "student.1", page1, true)
    await login("student2@example.com", "student.2", page2, true)
    await login("student3@example.com", "student.3", page3, true)
    await login("teacher@example.com", "teacher", page4, true)

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
    await page1.waitForTimeout(1000)

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
    await page2.waitForTimeout(1000)

    // Student 3 submits an answer
    await page3.goto("http://project-331.local/")
    await page3
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(page3).toHaveURL("http://project-331.local/org/uh-cs")
    await page3.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await expect(page3).toHaveURL("http://project-331.local/org/uh-cs/courses/peer-review-course")
    await selectCourseInstanceIfPrompted(page3)
    await page3.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await expect(page3).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1",
    )
    await page3.getByRole("link", { name: "1 Page One" }).click()
    await expect(page3).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-1",
    )
    await page3.frameLocator("iframe").getByRole("checkbox", { name: "c" }).click()
    await page3.getByRole("button", { name: "Submit" }).click()
    await page3.waitForTimeout(1000)

    // Student 1 starts peer review
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-before-filling-peer-review",
      page: page1,
      clearNotifications: true,
    })
    await page1.getByRole("button", { name: "Start peer review" }).click()
    await page1.getByPlaceholder("Write a review").fill("yes")
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-after-filling-1-peer-review",
      page: page1,
      clearNotifications: true,
    })
    await page1.getByRole("button", { name: "Submit" }).click()
    await page1.getByPlaceholder("Write a review").fill("kinda")
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-after-filling-2-peer-review",
      page: page1,
      clearNotifications: true,
    })
    await page1.getByRole("button", { name: "Submit" }).click()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-after-filling-all-peer-reviews",
      page: page1,
      clearNotifications: true,
    })

    // Student 2 starts peer review
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-before-filling-peer-review",
      page: page2,
      clearNotifications: true,
    })
    await page2.getByRole("button", { name: "Start peer review" }).click()
    await page2.getByPlaceholder("Write a review").fill("yes")
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-after-filling-1-peer-review",
      page: page2,
      clearNotifications: true,
    })
    await page2.getByRole("button", { name: "Submit" }).click()
    await page2.getByPlaceholder("Write a review").fill("kinda")
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-after-filling-2-peer-review",
      page: page2,
      clearNotifications: true,
    })
    await page2.getByRole("button", { name: "Submit" }).click()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-after-filling-all-peer-reviews",
      page: page2,
      clearNotifications: true,
    })

    // Student 3 starts peer review
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-3-before-filling-peer-reviews",
      page: page3,
      clearNotifications: true,
    })
    await page3.getByRole("button", { name: "Start peer review" }).click()
    await page3.getByPlaceholder("Write a review").fill("yes")
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-3-after-filling-1-peer-review",
      page: page3,
      clearNotifications: true,
    })
    await page3.getByRole("button", { name: "Submit" }).click()
    await page3.getByPlaceholder("Write a review").fill("kinda")
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-3-after-filling-2-peer-review",
      page: page3,
      clearNotifications: true,
    })
    await page3.getByRole("button", { name: "Submit" }).click()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-3-after-filling-all-peer-reviews",
      page: page3,
      clearNotifications: true,
    })

    // Teacher checks answers requiring attention
    await page4.goto("http://project-331.local/")
    await page4.waitForTimeout(1000)
    await page4
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(page4).toHaveURL("http://project-331.local/org/uh-cs")
    await page4.getByRole("link", { name: "Manage course 'Peer review Course'" }).click()
    await expect(page4).toHaveURL(
      "http://project-331.local/manage/courses/c47e1cfd-a2da-4fd1-aca8-f2b2d906c4c0",
    )
    await page4.getByRole("tab", { name: "Exercises" }).click()
    await expect(page4).toHaveURL(
      "http://project-331.local/manage/courses/c47e1cfd-a2da-4fd1-aca8-f2b2d906c4c0/exercises",
    )
    await page4
      .locator('li:has-text("Best exercise View submissionsView answers requiring attention(3)")')
      .getByRole("link", { name: "View answers requiring attention" })
      .click()
    await expect(page4).toHaveURL(
      "http://project-331.local/manage/exercises/8dc9ed22-5afc-589b-928b-e637397da6d6/answers-requiring-attention",
    )
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "teacher-1-before-grading",
      page: page4,
      axeSkip: ["color-contrast", "frame-title-unique", "duplicate-id", "duplicate-id-active"],
      clearNotifications: true,
    })
    await page4.getByRole("button", { name: "Zero points" }).first().click()
    await page4.reload()

    await page4.getByRole("button", { name: "Full points" }).first().click()
    await page4.reload()

    await page4.getByRole("button", { name: "Custom points" }).click()
    await page4.locator('input[type="number"]').fill("0.5")
    await page4.getByRole("button", { name: "Give custom points" }).click()
    await page4.reload()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "teacher-after-grading",
      page: page4,
      axeSkip: ["color-contrast", "frame-title-unique", "duplicate-id", "duplicate-id-active"],
      clearNotifications: true,
    })

    // Student 1 views his reviews and grading
    await page1.reload()
    await page1.getByText("Peer reviews received from other students2").click()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-checking-their-peer-reviews",
      page: page1,
      axeSkip: ["heading-order"],
      clearNotifications: true,
      beforeScreenshot: () =>
        page1.locator("text=Peer reviews received from other students").scrollIntoViewIfNeeded(),
    })

    // Student 2 views his reviews and grading
    await page2.reload()
    await page2.getByText("Peer reviews received from other students2").click()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-checking-their-peer-reviews",
      page: page2,
      axeSkip: ["heading-order"],
      clearNotifications: true,
      beforeScreenshot: () =>
        page2.locator("text=Peer reviews received from other students").scrollIntoViewIfNeeded(),
    })

    // Student 3 views his reviews and grading
    await page3.reload()
    await page3.getByText("Peer reviews received from other students2").click()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-3-checking-their-peer-reviews",
      page: page3,
      axeSkip: ["heading-order"],
      clearNotifications: true,
      beforeScreenshot: () =>
        page3.locator("text=Peer reviews received from other students").scrollIntoViewIfNeeded(),
    })
  })
})
