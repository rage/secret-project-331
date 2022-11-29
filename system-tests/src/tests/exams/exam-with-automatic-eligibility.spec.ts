import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("Can take exam after enough course points", async ({ headless, page }) => {
  await page.goto("http://project-331.local/org/uh-cs/exams/b2168b2f-f721-4771-a35d-ca75ca0937b1")

  await expectScreenshotsToMatchSnapshots({
    headless,
    page,
    snapshotName: "cant-take-exam-before-meeting-exercise-requirements",
    waitForThisToBeVisibleAndStable: [
      "text=Automatic course exam",
      "text=Submissions are no longer accepted after",
      "text=You have 1 minutes to complete the exam after starting",
      "text=You are not eligible for taking this exam.",
    ],
  })

  await page.goto(
    "http://project-331.local/org/uh-cs/courses/automatic-course-with-exam/chapter-1/page-1",
  )
  await selectCourseInstanceIfPrompted(page)
  await page.frameLocator("iframe").getByRole("checkbox", { name: "b" }).click()
  await page.getByRole("button", { name: "Submit" }).click()
  await page.getByRole("link", { name: "Automatic Course with Exam" }).click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/automatic-course-with-exam",
  )
  // Make sure that the course isn't completed before taking an exam.
  await page.waitForSelector("text=Top level pages")
  await expect(page.locator("text=Congratulations!")).toHaveCount(0)

  await page.goto("http://project-331.local/org/uh-cs/exams/b2168b2f-f721-4771-a35d-ca75ca0937b1")

  await expectScreenshotsToMatchSnapshots({
    headless,
    page,
    snapshotName: "can-take-exam-after-meeting-exercise-requirements",
    waitForThisToBeVisibleAndStable: [
      "text=Automatic course exam",
      "text=Submissions are no longer accepted after",
      "text=You have 1 minutes to complete the exam after starting",
    ],
  })

  page.on("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Start the exam!" }).click()
})
