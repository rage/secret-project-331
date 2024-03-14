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
      page.getByText("Automatic course exam"),
      page.getByText("Submissions are no longer accepted after"),
      page.getByText("You have 1 minutes to complete the exam after starting"),
      page.getByText("You have not met the requirements for taking this exam."),
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
  await page.getByText("Welcome to...").waitFor()
  await expect(page.getByText("Congratulations!")).toHaveCount(0)

  await page.goto("http://project-331.local/org/uh-cs/exams/b2168b2f-f721-4771-a35d-ca75ca0937b1")

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    screenshotTarget: page,
    snapshotName: "can-take-exam-after-meeting-exercise-requirements",
    waitForTheseToBeVisibleAndStable: [
      page.getByText("Automatic course exam"),
      page.getByText("Submissions are no longer accepted after"),
      page.getByText("You have 1 minutes to complete the exam after starting"),
    ],
  })

  page.on("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Start the exam!" }).click()
})
