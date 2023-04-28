import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("Can take exam after enough course points", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/org/uh-cs/exams/b2168b2f-f721-4771-a35d-ca75ca0937b1")

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    screenshotTarget: page,
    snapshotName: "cant-take-exam-before-meeting-exercise-requirements",
    waitForTheseToBeVisibleAndStable: [
      page.locator("text=Automatic course exam"),
      page.locator("text=Submissions are no longer accepted after"),
      page.locator("text=You have 1 minutes to complete the exam after starting"),
      page.locator(
        "text=The exam is not open yet. Use this button to access the exam once the exam starts.",
      ),
    ],
  })

  await page.goto(
    "http://project-331.local/org/uh-cs/courses/automatic-course-with-exam/chapter-1/page-1",
  )
  await selectCourseInstanceIfPrompted(page)
  await page.frameLocator("iframe").getByRole("checkbox", { name: "b" }).click()
  await page.getByRole("button", { name: "Submit" }).click()
  await page.getByRole("button", { name: "Try again" }).waitFor()
  await page.getByRole("link", { name: "Automatic Course with Exam" }).click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/automatic-course-with-exam",
  )
  // Make sure that the course isn't completed before taking an exam.
  await page.waitForSelector("text=Welcome to...")
  await expect(page.locator("text=Congratulations!")).toHaveCount(0)

  await page.goto("http://project-331.local/org/uh-cs/exams/b2168b2f-f721-4771-a35d-ca75ca0937b1")

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    screenshotTarget: page,
    snapshotName: "can-take-exam-after-meeting-exercise-requirements",
    waitForTheseToBeVisibleAndStable: [
      page.locator("text=Automatic course exam"),
      page.locator("text=Submissions are no longer accepted after"),
      page.locator("text=You have 1 minutes to complete the exam after starting"),
    ],
  })

  page.on("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Start the exam!" }).click()
})
