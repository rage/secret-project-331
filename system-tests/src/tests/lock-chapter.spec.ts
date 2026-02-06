import { BrowserContext, expect, test } from "@playwright/test"

import { ChapterSelector } from "@/utils/components/ChapterSelector"
import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import { clickPageInChapterByTitle } from "@/utils/flows/pagesInChapter.flow"
import { getLocatorForNthExerciseServiceIframe } from "@/utils/iframeLocators"
import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"

const LOCK_CHAPTERS_COURSE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

test.describe("Chapter locking feature", () => {
  let studentContext: BrowserContext

  test.beforeEach(async ({ browser }) => {
    studentContext = await browser.newContext({
      storageState: "src/states/student1@example.com.json",
    })
  })

  test.afterEach(async () => {
    await studentContext.close()
  })

  test("Chapter locking complete flow", async ({ browser }) => {
    const teacherContext = await browser.newContext({
      storageState: "src/states/teacher@example.com.json",
    })
    const studentPage = await studentContext.newPage()
    const teacherPage = await teacherContext.newPage()

    await test.step("Navigate to course and verify first chapter is unlocked", async () => {
      await studentPage.goto("http://project-331.local/")
      await studentPage.getByRole("link", { name: "All organizations" }).click()
      await selectOrganization(
        studentPage,
        "University of Helsinki, Department of Mathematics and Statistics",
      )
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await selectCourseInstanceIfPrompted(studentPage)
      const chapterSelector = new ChapterSelector(studentPage)
      await chapterSelector.clickChapterByTitle("Chapter 1 - Lockable")
      await clickPageInChapterByTitle(studentPage, "Lock Chapter Page")
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.getByText("Mark Chapter as Complete").waitFor()
      await expect(studentPage.getByRole("button", { name: "Lock Chapter" })).toBeVisible()
    })

    await test.step("Submit exercise in Chapter 1", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      const chapterSelector = new ChapterSelector(studentPage)
      await chapterSelector.clickChapterByTitle("Chapter 1 - Lockable")
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 1")
      await selectCourseInstanceIfPrompted(studentPage)
      await expect(
        studentPage.getByText(
          "You will not receive points for this exercise until you lock the chapter and a teacher reviews your answer.",
        ),
      ).toBeVisible()
      const exerciseFrame = await getLocatorForNthExerciseServiceIframe(studentPage, "quizzes", 1)
      await exerciseFrame.getByRole("button", { name: "Correct answer" }).click()
      await studentPage.getByRole("button", { name: "Submit" }).click()
      await studentPage.getByText("Try again").waitFor()
    })

    await test.step("Verify Chapter 2 is locked initially and exercises are blocked", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      const chapterSelector = new ChapterSelector(studentPage)
      await chapterSelector.clickChapterByTitle("Chapter 2 - Add Lock Later")
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 2")
      await selectCourseInstanceIfPrompted(studentPage)
      await expect(
        studentPage.getByText(
          "Complete and lock the previous chapter to unlock exercises in this chapter.",
        ),
      ).toBeVisible()
      await expect(studentPage.getByRole("button", { name: "Submit" })).toBeHidden()
    })

    await test.step("Verify backend rejects locking Chapter 2 with unmet prerequisites", async () => {
      const chaptersResponse = await studentPage.request.get(
        `http://project-331.local/api/v0/course-material/courses/${LOCK_CHAPTERS_COURSE_ID}/chapters`,
      )
      expect(chaptersResponse.ok()).toBeTruthy()
      const chaptersData = await chaptersResponse.json()
      const chapter2 = chaptersData.modules
        .flatMap((m: { chapters: Array<{ id: string; name: string }> }) => m.chapters)
        .find((c: { name: string }) => c.name.includes("Chapter 2"))
      const lockResponse = await studentPage.request.post(
        `http://project-331.local/api/v0/course-material/chapters/${chapter2.id}/lock`,
      )
      expect(lockResponse.status()).toBeGreaterThanOrEqual(400)
    })

    await test.step("Lock Chapter 1 with confirmation dialog", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      const chapterSelector = new ChapterSelector(studentPage)
      await chapterSelector.clickChapterByTitle("Chapter 1 - Lockable")
      await clickPageInChapterByTitle(studentPage, "Lock Chapter Page")
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.getByRole("button", { name: "Lock Chapter" }).click()
      await expect(
        studentPage.getByText("Are you sure you want to lock this chapter?"),
      ).toBeVisible()
      await studentPage.getByRole("button", { name: "Yes" }).click()
      await studentPage.getByText("Chapter locked").waitFor()
      await expect(
        studentPage.getByText(
          "The current chapter is locked, and you can no longer submit exercises.",
        ),
      ).toBeVisible()
    })

    await test.step("Verify model solution is visible after locking", async () => {
      await expect(studentPage.getByRole("heading", { name: "Model Solution" })).toBeVisible()
      await expect(
        studentPage.getByText(
          "Congratulations on completing Chapter 1! Here's a model solution for the Customer Behavior Analysis Project.",
        ),
      ).toBeVisible()
    })

    await test.step("Teacher reviews exercise from Chapter 1", async () => {
      await teacherPage.goto(
        `http://project-331.local/manage/courses/${LOCK_CHAPTERS_COURSE_ID}/pages`,
      )
      await teacherPage.getByRole("tab", { name: "Exercises" }).click()
      await teacherPage.getByRole("link", { name: "View answers requiring" }).click()
      await teacherPage.getByRole("button", { name: "Custom points" }).click()
      await teacherPage.getByRole("slider").fill("1")
      await waitForSuccessNotification(teacherPage, async () => {
        await teacherPage.getByRole("button", { name: "Give custom points" }).click()
      })
    })

    await test.step("Student sees reviewed exercise results from Chapter 1", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      const chapterSelector = new ChapterSelector(studentPage)
      await chapterSelector.clickChapterByTitle("Chapter 1 - Lockable")
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 1")
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.reload()
      await expect(studentPage.getByTestId("exercise-points")).toContainText("1/1")
      await studentPage.getByText("Your answer has been reviewed").waitFor()
      await expect(
        studentPage
          .getByText("The current chapter is locked, and you can no longer submit exercises.")
          .first(),
      ).toBeHidden()
    })

    await test.step("Verify manual review message is hidden when chapter is locked", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      const chapterSelector = new ChapterSelector(studentPage)
      await chapterSelector.clickChapterByTitle("Chapter 1 - Lockable")
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 1")
      await selectCourseInstanceIfPrompted(studentPage)
      await expect(
        studentPage.getByText(
          "You will not receive points for this exercise until you lock the chapter and a teacher reviews your answer.",
        ),
      ).toBeHidden()
      await expect(
        studentPage
          .getByText("The current chapter is locked, and you can no longer submit exercises.")
          .first(),
      ).toBeHidden()
    })

    await test.step("Verify exercise submission is blocked in locked chapter", async () => {
      await expect(
        studentPage
          .getByText("The current chapter is locked, and you can no longer submit exercises.")
          .first(),
      ).toBeHidden()
      await expect(studentPage.getByText("Your answer has been reviewed")).toBeVisible()
      await expect(studentPage.getByRole("button", { name: "Submit" })).toBeHidden()
    })

    await test.step("Verify cannot lock an already-locked chapter", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      const chapterSelector = new ChapterSelector(studentPage)
      await chapterSelector.clickChapterByTitle("Chapter 1 - Lockable")
      await clickPageInChapterByTitle(studentPage, "Lock Chapter Page")
      await selectCourseInstanceIfPrompted(studentPage)
      await expect(studentPage.getByText("Chapter locked")).toBeVisible()
      await expect(studentPage.getByRole("button", { name: "Lock Chapter" })).toBeHidden()
    })

    await test.step("Verify Chapter 2 unlocks after completing Chapter 1", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      const chapterSelector = new ChapterSelector(studentPage)
      await chapterSelector.clickChapterByTitle("Chapter 2 - Add Lock Later")
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 2")
      await selectCourseInstanceIfPrompted(studentPage)
      await expect(studentPage.getByRole("button", { name: "Submit" })).toBeVisible()
      await expect(
        studentPage.getByText(
          "The current chapter is locked, and you can no longer submit exercises.",
        ),
      ).toBeHidden()
      await expect(
        studentPage.getByText(
          "You will not receive points for this exercise until you lock the chapter and a teacher reviews your answer.",
        ),
      ).toBeVisible()
    })

    await test.step("Submit exercise in Chapter 2", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      const chapterSelector = new ChapterSelector(studentPage)
      await chapterSelector.clickChapterByTitle("Chapter 2 - Add Lock Later")
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 2")
      await selectCourseInstanceIfPrompted(studentPage)
      const exerciseFrame = await getLocatorForNthExerciseServiceIframe(studentPage, "quizzes", 1)
      await exerciseFrame.getByRole("button", { name: "Correct answer" }).click()
      await studentPage.getByRole("button", { name: "Submit" }).click()
      await studentPage.getByText("Try again").waitFor()
    })

    await test.step("Lock Chapter 2", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      const chapterSelector = new ChapterSelector(studentPage)
      await chapterSelector.clickChapterByTitle("Chapter 2 - Add Lock Later")
      await clickPageInChapterByTitle(studentPage, "Lock Chapter Page")
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.getByText("Mark Chapter as Complete").waitFor()
      await studentPage.getByRole("button", { name: "Lock Chapter" }).click()
      await expect(
        studentPage.getByText("Are you sure you want to lock this chapter?"),
      ).toBeVisible()
      await studentPage.getByRole("button", { name: "Yes" }).click()
      await studentPage.getByText("Chapter locked").waitFor()
    })

    await test.step("Teacher reviews exercise from Chapter 2", async () => {
      await teacherPage.goto(
        `http://project-331.local/manage/courses/${LOCK_CHAPTERS_COURSE_ID}/pages`,
      )
      await teacherPage.getByRole("tab", { name: "Exercises" }).click()
      await teacherPage.getByRole("link", { name: "View answers requiring" }).click()
      await teacherPage.getByRole("button", { name: "Custom points" }).click()
      await teacherPage.getByRole("slider").fill("1")
      await waitForSuccessNotification(teacherPage, async () => {
        await teacherPage.getByRole("button", { name: "Give custom points" }).click()
      })
    })

    await test.step("Student sees reviewed exercise results from Chapter 2", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      const chapterSelector = new ChapterSelector(studentPage)
      await chapterSelector.clickChapterByTitle("Chapter 2 - Add Lock Later")
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 2")
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.reload()
      await expect(studentPage.getByTestId("exercise-points")).toContainText("1/1")
      await studentPage.getByText("Your answer has been reviewed").waitFor()
      await expect(
        studentPage
          .getByText("The current chapter is locked, and you can no longer submit exercises.")
          .first(),
      ).toBeHidden()
    })

    await test.step("Verify exercise in Chapter 2 cannot be submitted after locking", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      const chapterSelector = new ChapterSelector(studentPage)
      await chapterSelector.clickChapterByTitle("Chapter 2 - Add Lock Later")
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 2")
      await selectCourseInstanceIfPrompted(studentPage)
      await expect(
        studentPage
          .getByText("The current chapter is locked, and you can no longer submit exercises.")
          .first(),
      ).toBeHidden()
      await expect(studentPage.getByText("Your answer has been reviewed")).toBeVisible()
      await expect(studentPage.getByRole("button", { name: "Submit" })).toBeHidden()
      await expect(
        studentPage.getByText(
          "You will not receive points for this exercise until you lock the chapter and a teacher reviews your answer.",
        ),
      ).toBeHidden()
    })

    await test.step("Verify exercises and reviews blocked when chapter is locked", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      const chapterSelector = new ChapterSelector(studentPage)
      await chapterSelector.clickChapterByTitle("Chapter 1 - Lockable")
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 1")
      await selectCourseInstanceIfPrompted(studentPage)
      await expect(
        studentPage
          .getByText("The current chapter is locked, and you can no longer submit exercises.")
          .first(),
      ).toBeHidden()
      await expect(studentPage.getByText("Your answer has been reviewed")).toBeVisible()
      await expect(studentPage.getByRole("button", { name: "Submit" })).toBeHidden()
    })

    await teacherContext.close()
  })

  test("Chapter locking security and data isolation", async ({ browser }) => {
    const student3Context = await browser.newContext({
      storageState: "src/states/student3@example.com.json",
    })
    const student2Context = await browser.newContext({
      storageState: "src/states/student2@example.com.json",
    })
    const studentPage = await student3Context.newPage()
    const student2Page = await student2Context.newPage()

    await test.step("Verify model solution is NOT visible before locking", async () => {
      await student2Page.goto("http://project-331.local/")
      await student2Page.getByRole("link", { name: "All organizations" }).click()
      await selectOrganization(
        student2Page,
        "University of Helsinki, Department of Mathematics and Statistics",
      )
      await student2Page.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await selectCourseInstanceIfPrompted(student2Page)
      const chapterSelector = new ChapterSelector(student2Page)
      await chapterSelector.clickChapterByTitle("Chapter 1 - Lockable")
      await clickPageInChapterByTitle(student2Page, "Lock Chapter Page")
      await selectCourseInstanceIfPrompted(student2Page)

      await expect(student2Page.getByRole("button", { name: "Lock Chapter" })).toBeVisible()
      await expect(student2Page.getByRole("heading", { name: "Model Solution" })).toBeHidden()
      await expect(
        student2Page.getByText("Congratulations on completing Chapter 1! Here's a model solution"),
      ).toBeHidden()
    })

    await test.step("Verify page API does not leak model solution before locking", async () => {
      const pageResponse = await student2Page.request.get(
        `http://project-331.local/api/v0/course-material/courses/lock-chapter-test-course/page-by-path/chapter-1/lock-page`,
      )
      expect(pageResponse.ok()).toBeTruthy()
      const pageData = await pageResponse.json()
      const pageContent = JSON.stringify(pageData.page?.content || {})
      expect(pageContent).not.toContain("Model Solution")
      expect(pageContent).not.toContain("Congratulations on completing Chapter 1")
    })

    await test.step("Lock Chapter 1 as student2", async () => {
      await student2Page.getByRole("button", { name: "Lock Chapter" }).click()
      await expect(
        student2Page.getByText("Are you sure you want to lock this chapter?"),
      ).toBeVisible()
      await student2Page.getByRole("button", { name: "Yes" }).click()
      await student2Page.getByText("Chapter locked").waitFor()
    })

    await test.step("Verify model solution IS visible after locking for student2", async () => {
      await expect(student2Page.getByRole("heading", { name: "Model Solution" })).toBeVisible()
      await expect(
        student2Page.getByText(
          "Congratulations on completing Chapter 1! Here's a model solution for the Customer Behavior Analysis Project.",
        ),
      ).toBeVisible()
    })

    await test.step("Verify page API includes model solution after locking", async () => {
      const pageResponse = await student2Page.request.get(
        `http://project-331.local/api/v0/course-material/courses/lock-chapter-test-course/page-by-path/chapter-1/lock-page`,
      )
      expect(pageResponse.ok()).toBeTruthy()
      const pageData = await pageResponse.json()
      const pageContent = JSON.stringify(pageData.page?.content || {})
      expect(pageContent).toContain("Model Solution")
      expect(pageContent).toContain("Congratulations on completing Chapter 1")
    })

    await test.step("Verify student3 cannot see student2's model solution", async () => {
      await studentPage.goto("http://project-331.local/")
      await studentPage.getByRole("link", { name: "All organizations" }).click()
      await selectOrganization(
        studentPage,
        "University of Helsinki, Department of Mathematics and Statistics",
      )
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await selectCourseInstanceIfPrompted(studentPage)
      const chapterSelector = new ChapterSelector(studentPage)
      await chapterSelector.clickChapterByTitle("Chapter 1 - Lockable")
      await clickPageInChapterByTitle(studentPage, "Lock Chapter Page")
      await selectCourseInstanceIfPrompted(studentPage)

      await expect(studentPage.getByRole("heading", { name: "Model Solution" })).toBeHidden()
      await expect(
        studentPage.getByText("Congratulations on completing Chapter 1! Here's a model solution"),
      ).toBeHidden()
    })

    await test.step("Verify lock preview shows unreturned exercises warning", async () => {
      await student2Page.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      const chapterSelector = new ChapterSelector(student2Page)
      await chapterSelector.clickChapterByTitle("Chapter 2 - Add Lock Later")
      await clickPageInChapterByTitle(student2Page, "Exercise in Chapter 2")
      await selectCourseInstanceIfPrompted(student2Page)

      const chaptersResponse = await student2Page.request.get(
        `http://project-331.local/api/v0/course-material/courses/${LOCK_CHAPTERS_COURSE_ID}/chapters`,
      )
      expect(chaptersResponse.ok()).toBeTruthy()
      const chaptersData = await chaptersResponse.json()
      const chapter2 = chaptersData.modules
        .flatMap((m: { chapters: Array<{ id: string; name: string }> }) => m.chapters)
        .find((c: { name: string }) => c.name.includes("Chapter 2"))

      await student2Page.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      const chapterSelector2 = new ChapterSelector(student2Page)
      await chapterSelector2.clickChapterByTitle("Chapter 2 - Add Lock Later")
      await clickPageInChapterByTitle(student2Page, "Lock Chapter Page")
      await selectCourseInstanceIfPrompted(student2Page)
      await student2Page.getByText("Mark Chapter as Complete").waitFor()

      await student2Page.getByRole("button", { name: "Lock Chapter" }).click()
      const previewResponse = await student2Page.request.get(
        `http://project-331.local/api/v0/course-material/chapters/${chapter2.id}/lock-preview`,
      )
      expect(previewResponse.ok()).toBeTruthy()
      const preview = await previewResponse.json()
      expect(preview).toHaveProperty("has_unreturned_exercises")
      expect(preview).toHaveProperty("unreturned_exercises_count")
      expect(preview.has_unreturned_exercises).toBe(true)
      expect(preview.unreturned_exercises_count).toBeGreaterThan(0)
      await expect(
        student2Page.getByText(new RegExp(`You have \\d+ exercise\\(s\\) in this chapter`)),
      ).toBeVisible()
      await student2Page.getByRole("button", { name: "No" }).click()
    })

    await student3Context.close()
    await student2Context.close()
  })
})
