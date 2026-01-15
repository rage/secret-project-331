import { BrowserContext, expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import { clickPageInChapterByTitle } from "@/utils/flows/pagesInChapter.flow"
import { selectOrganization } from "@/utils/organizationUtils"

test.describe("Chapter locking feature", () => {
  let studentContext: BrowserContext
  let teacherContext: BrowserContext
  let student2Context: BrowserContext

  test.beforeEach(async ({ browser }) => {
    studentContext = await browser.newContext({
      storageState: "src/states/student1@example.com.json",
    })
    student2Context = await browser.newContext({
      storageState: "src/states/student2@example.com.json",
    })
    teacherContext = await browser.newContext({
      storageState: "src/states/teacher@example.com.json",
    })
  })

  test.afterEach(async () => {
    await Promise.all([studentContext.close(), student2Context.close(), teacherContext.close()])
  })

  test("Chapter locking works correctly with course-level setting", async () => {
    const studentPage = await studentContext.newPage()

    await test.step("Navigate to course as student and verify first chapter is unlocked", async () => {
      await studentPage.goto("http://project-331.local/")
      await studentPage.getByRole("link", { name: "All organizations" }).click()
      await selectOrganization(
        studentPage,
        "University of Helsinki, Department of Mathematics and Statistics",
      )
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.getByText("Chapter 1 - Lockable").click()
      await clickPageInChapterByTitle(studentPage, "Lock Chapter Page")
    })

    await test.step("Verify lock block is visible and first chapter is unlocked", async () => {
      await studentPage.getByText("Mark Chapter as Complete").waitFor()
      await expect(studentPage.getByRole("button", { name: "Lock Chapter" })).toBeVisible()
    })

    await test.step("Verify Chapter 2 is locked initially", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await studentPage.getByText("Chapter 2 - Add Lock Later").click()
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 2")
      await selectCourseInstanceIfPrompted(studentPage)
      await expect(
        studentPage.getByText(
          "The current chapter is locked, and you can no longer submit exercises.",
        ),
      ).toBeVisible()
      await expect(studentPage.getByRole("button", { name: "Submit" })).toBeHidden()
    })

    await test.step("Lock Chapter 1", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await studentPage.getByText("Chapter 1 - Lockable").click()
      await clickPageInChapterByTitle(studentPage, "Lock Chapter Page")
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.getByRole("button", { name: "Lock Chapter" }).click()
      await expect(
        studentPage.getByText("Are you sure you want to lock this chapter?"),
      ).toBeVisible()
      await studentPage.getByRole("button", { name: "Confirm" }).click()
      await studentPage.getByText("Chapter locked").waitFor()
      await expect(
        studentPage.getByText(
          "The current chapter is locked, and you can no longer submit exercises.",
        ),
      ).toBeVisible()
    })

    await test.step("Verify model solution content is visible after locking", async () => {
      await expect(studentPage.getByRole("heading", { name: "Model Solution" })).toBeVisible()
      await expect(
        studentPage.getByText(
          "Congratulations on completing Chapter 1! Here's a model solution for the Customer Behavior Analysis Project.",
        ),
      ).toBeVisible()
    })

    await test.step("Verify Chapter 2 is now unlocked after completing Chapter 1", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await studentPage.getByText("Chapter 2 - Add Lock Later").click()
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

    await test.step("Verify exercise in locked Chapter 1 cannot be submitted", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await studentPage.getByText("Chapter 1 - Lockable").click()
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 1")
      await selectCourseInstanceIfPrompted(studentPage)
      await expect(
        studentPage
          .getByText("The current chapter is locked, and you can no longer submit exercises.")
          .first(),
      ).toBeVisible()
      await expect(studentPage.getByRole("button", { name: "Submit" })).toBeHidden()
      await expect(
        studentPage.getByText(
          "You will not receive points for this exercise until you lock the chapter and a teacher reviews your answer.",
        ),
      ).toBeHidden()
    })

    await test.step("Navigate to Chapter 2 and verify lock block is visible", async () => {
      await studentPage.goto(
        "http://project-331.local/org/uh-mathstat/courses/lock-chapter-test-course/chapter-2/exercise-page",
      )
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.getByText("Mark Chapter as Complete").waitFor()
      await expect(studentPage.getByRole("button", { name: "Lock Chapter" })).toBeVisible()
    })

    await test.step("Lock Chapter 2", async () => {
      await studentPage.getByRole("button", { name: "Lock Chapter" }).click()
      await expect(
        studentPage.getByText("Are you sure you want to lock this chapter?"),
      ).toBeVisible()
      await studentPage.getByRole("button", { name: "Confirm" }).click()
      await studentPage.getByText("Chapter locked").waitFor()
      await expect(
        studentPage
          .getByText("The current chapter is locked, and you can no longer submit exercises.")
          .first(),
      ).toBeVisible()
    })

    await test.step("Verify persistence - reload and check locked state", async () => {
      await studentPage.reload()
      await selectCourseInstanceIfPrompted(studentPage)
      await expect(studentPage.getByText("Chapter locked")).toBeVisible()
    })

    await test.step("Verify Chapter 1 still locked after reload", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await studentPage.getByText("Chapter 1 - Lockable").click()
      await clickPageInChapterByTitle(studentPage, "Lock Chapter Page")
      await selectCourseInstanceIfPrompted(studentPage)
      await expect(studentPage.getByText("Chapter locked")).toBeVisible()
    })

    await test.step("Verify exercise in Chapter 2 cannot be submitted after locking", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await studentPage.getByText("Chapter 2 - Add Lock Later").click()
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 2")
      await selectCourseInstanceIfPrompted(studentPage)
      await expect(
        studentPage
          .getByText("The current chapter is locked, and you can no longer submit exercises.")
          .first(),
      ).toBeVisible()
      await expect(studentPage.getByRole("button", { name: "Submit" })).toBeHidden()
      await expect(
        studentPage.getByText(
          "You will not receive points for this exercise until you lock the chapter and a teacher reviews your answer.",
        ),
      ).toBeHidden()
    })
  })

  test("Chapter locking security and data leak prevention", async () => {
    const studentPage = await studentContext.newPage()
    const student2Page = await student2Context.newPage()

    await test.step("Verify model solution is NOT in page content before locking (API test)", async () => {
      await studentPage.goto("http://project-331.local/")
      await studentPage.getByRole("link", { name: "All organizations" }).click()
      await selectOrganization(
        studentPage,
        "University of Helsinki, Department of Mathematics and Statistics",
      )
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.getByText("Chapter 1 - Lockable").click()
      await clickPageInChapterByTitle(studentPage, "Lock Chapter Page")
      await selectCourseInstanceIfPrompted(studentPage)

      const pageContent = await studentPage.content()
      expect(pageContent).not.toContain("Model Solution")
      expect(pageContent).not.toContain(
        "Congratulations on completing Chapter 1! Here's a model solution",
      )
    })

    await test.step("Verify lock preview endpoint returns correct data for current user", async () => {
      await studentPage.goto("http://project-331.local/")
      await studentPage.getByRole("link", { name: "All organizations" }).click()
      await selectOrganization(
        studentPage,
        "University of Helsinki, Department of Mathematics and Statistics",
      )
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.getByText("Chapter 1 - Lockable").click()
      await clickPageInChapterByTitle(studentPage, "Lock Chapter Page")
      await selectCourseInstanceIfPrompted(studentPage)

      const courseResponse = await studentPage.request.get(
        "http://project-331.local/api/v0/course-material/courses/",
      )
      const courses = await courseResponse.json()
      const lockChapterTestCourse = courses.find(
        (c: { slug: string }) => c.slug === "lock-chapter-test-course",
      )
      expect(lockChapterTestCourse).toBeDefined()

      const chaptersResponse = await studentPage.request.get(
        `http://project-331.local/api/v0/course-material/courses/${lockChapterTestCourse.id}/chapters`,
      )
      expect(chaptersResponse.ok()).toBeTruthy()
      const chaptersData = await chaptersResponse.json()
      const chapter1 = chaptersData.modules
        .flatMap((m: { chapters: Array<{ id: string; name: string }> }) => m.chapters)
        .find((c: { name: string }) => c.name.includes("Chapter 1"))
      expect(chapter1).toBeDefined()

      const previewResponse = await studentPage.request.get(
        `http://project-331.local/api/v0/course-material/chapters/${chapter1.id}/lock-preview`,
      )
      expect(previewResponse.ok()).toBeTruthy()
      const preview = await previewResponse.json()
      expect(preview).toHaveProperty("has_unreturned_exercises")
      expect(preview).toHaveProperty("unreturned_exercises_count")
      expect(preview).toHaveProperty("unreturned_exercises")
      expect(Array.isArray(preview.unreturned_exercises)).toBe(true)
    })

    await test.step("Verify user chapter locks endpoint only returns current user's locks", async () => {
      const courseResponse = await studentPage.request.get(
        "http://project-331.local/api/v0/course-material/courses/",
      )
      const courses = await courseResponse.json()
      const lockChapterTestCourse = courses.find(
        (c: { slug: string }) => c.slug === "lock-chapter-test-course",
      )

      const locksResponse = await studentPage.request.get(
        `http://project-331.local/api/v0/course-material/courses/${lockChapterTestCourse.id}/user-chapter-locks`,
      )
      expect(locksResponse.ok()).toBeTruthy()
      const locks = await locksResponse.json()
      expect(Array.isArray(locks)).toBe(true)
      locks.forEach((lock: { user_id: string }) => {
        expect(lock.user_id).toBeDefined()
      })
    })

    await test.step("Lock Chapter 1 as student1", async () => {
      await studentPage.getByRole("button", { name: "Lock Chapter" }).click()
      await expect(
        studentPage.getByText("Are you sure you want to lock this chapter?"),
      ).toBeVisible()
      await studentPage.getByRole("button", { name: "Confirm" }).click()
      await studentPage.getByText("Chapter locked").waitFor()
    })

    await test.step("Verify model solution IS now visible after locking", async () => {
      await expect(studentPage.getByRole("heading", { name: "Model Solution" })).toBeVisible()
      await expect(
        studentPage.getByText(
          "Congratulations on completing Chapter 1! Here's a model solution for the Customer Behavior Analysis Project.",
        ),
      ).toBeVisible()
    })

    await test.step("Verify student2 cannot see student1's chapter locks", async () => {
      await student2Page.goto("http://project-331.local/")
      await student2Page.getByRole("link", { name: "All organizations" }).click()
      await selectOrganization(
        student2Page,
        "University of Helsinki, Department of Mathematics and Statistics",
      )
      await student2Page.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await selectCourseInstanceIfPrompted(student2Page)

      const courseResponse = await student2Page.request.get(
        "http://project-331.local/api/v0/course-material/courses/",
      )
      const courses = await courseResponse.json()
      const lockChapterTestCourse = courses.find(
        (c: { slug: string }) => c.slug === "lock-chapter-test-course",
      )

      const locksResponse = await student2Page.request.get(
        `http://project-331.local/api/v0/course-material/courses/${lockChapterTestCourse.id}/user-chapter-locks`,
      )
      expect(locksResponse.ok()).toBeTruthy()
      const locks = await locksResponse.json()
      expect(Array.isArray(locks)).toBe(true)
      locks.forEach((lock: { user_id: string }) => {
        expect(lock.user_id).toBeDefined()
      })
    })

    await test.step("Verify student2 cannot see model solution in locked chapter", async () => {
      await student2Page.getByText("Chapter 1 - Lockable").click()
      await clickPageInChapterByTitle(student2Page, "Lock Chapter Page")
      await selectCourseInstanceIfPrompted(student2Page)

      const pageContent = await student2Page.content()
      expect(pageContent).not.toContain("Model Solution")
      expect(pageContent).not.toContain(
        "Congratulations on completing Chapter 1! Here's a model solution",
      )
    })

    await test.step("Verify lock preview shows unreturned exercises warning", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await studentPage.getByText("Chapter 2 - Add Lock Later").click()
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 2")
      await selectCourseInstanceIfPrompted(studentPage)

      const courseResponse = await studentPage.request.get(
        "http://project-331.local/api/v0/course-material/courses/",
      )
      const courses = await courseResponse.json()
      const lockChapterTestCourse = courses.find(
        (c: { slug: string }) => c.slug === "lock-chapter-test-course",
      )
      const chaptersResponse = await studentPage.request.get(
        `http://project-331.local/api/v0/course-material/courses/${lockChapterTestCourse.id}/chapters`,
      )
      const chaptersData = await chaptersResponse.json()
      const chapter2 = chaptersData.modules
        .flatMap((m: { chapters: Array<{ id: string; name: string }> }) => m.chapters)
        .find((c: { name: string }) => c.name.includes("Chapter 2"))

      await studentPage.goto(
        `http://project-331.local/org/uh-mathstat/courses/lock-chapter-test-course/chapter-2/exercise-page`,
      )
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.getByText("Mark Chapter as Complete").waitFor()

      await studentPage.getByRole("button", { name: "Lock Chapter" }).click()
      const previewResponse = await studentPage.request.get(
        `http://project-331.local/api/v0/course-material/chapters/${chapter2.id}/lock-preview`,
      )
      expect(previewResponse.ok()).toBeTruthy()
      const preview = await previewResponse.json()
      expect(preview).toHaveProperty("has_unreturned_exercises")
      expect(preview).toHaveProperty("unreturned_exercises_count")
      expect(preview.has_unreturned_exercises).toBe(true)
      expect(preview.unreturned_exercises_count).toBeGreaterThan(0)
      await expect(
        studentPage.getByText(new RegExp(`You have \\d+ exercise\\(s\\) in this chapter`)),
      ).toBeVisible()
      await studentPage.getByRole("button", { name: "Cancel" }).click()
    })
  })

  test("Chapter locking sequential unlocking and module behavior", async () => {
    const studentPage = await studentContext.newPage()

    await test.step("Verify first chapter with exercises is automatically unlocked", async () => {
      await studentPage.goto("http://project-331.local/")
      await studentPage.getByRole("link", { name: "All organizations" }).click()
      await selectOrganization(
        studentPage,
        "University of Helsinki, Department of Mathematics and Statistics",
      )
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.getByText("Chapter 1 - Lockable").click()
      await clickPageInChapterByTitle(studentPage, "Lock Chapter Page")
      await selectCourseInstanceIfPrompted(studentPage)

      await expect(studentPage.getByRole("button", { name: "Lock Chapter" })).toBeVisible()
    })

    await test.step("Verify subsequent chapters are locked until previous is completed", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await studentPage.getByText("Chapter 2 - Add Lock Later").click()
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 2")
      await selectCourseInstanceIfPrompted(studentPage)

      await expect(
        studentPage.getByText(
          "The current chapter is locked, and you can no longer submit exercises.",
        ),
      ).toBeVisible()
      await expect(studentPage.getByRole("button", { name: "Submit" })).toBeHidden()
    })

    await test.step("Complete Chapter 1 to unlock Chapter 2", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await studentPage.getByText("Chapter 1 - Lockable").click()
      await clickPageInChapterByTitle(studentPage, "Lock Chapter Page")
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.getByRole("button", { name: "Lock Chapter" }).click()
      await studentPage.getByRole("button", { name: "Confirm" }).click()
      await studentPage.getByText("Chapter locked").waitFor()
    })

    await test.step("Verify Chapter 2 is now unlocked after completing Chapter 1", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await studentPage.getByText("Chapter 2 - Add Lock Later").click()
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 2")
      await selectCourseInstanceIfPrompted(studentPage)

      await expect(studentPage.getByRole("button", { name: "Submit" })).toBeVisible()
      await expect(
        studentPage.getByText(
          "The current chapter is locked, and you can no longer submit exercises.",
        ),
      ).toBeHidden()
    })

    await test.step("Verify Chapter 1 exercises are blocked after locking", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await studentPage.getByText("Chapter 1 - Lockable").click()
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 1")
      await selectCourseInstanceIfPrompted(studentPage)

      await expect(
        studentPage
          .getByText("The current chapter is locked, and you can no longer submit exercises.")
          .first(),
      ).toBeVisible()
      await expect(studentPage.getByRole("button", { name: "Submit" })).toBeHidden()
      await expect(
        studentPage.getByText(
          "You will not receive points for this exercise until you lock the chapter and a teacher reviews your answer.",
        ),
      ).toBeHidden()
    })

    await test.step("Verify lock state persists after page reload", async () => {
      await studentPage.reload()
      await selectCourseInstanceIfPrompted(studentPage)
      await expect(studentPage.getByText("Chapter locked")).toBeVisible()

      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await studentPage.getByText("Chapter 2 - Add Lock Later").click()
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 2")
      await selectCourseInstanceIfPrompted(studentPage)
      await expect(studentPage.getByRole("button", { name: "Submit" })).toBeVisible()
    })
  })

  test("Chapter locking with manual review message display", async () => {
    const studentPage = await studentContext.newPage()

    await test.step("Navigate to course and submit an exercise in Chapter 1", async () => {
      await studentPage.goto("http://project-331.local/")
      await studentPage.getByRole("link", { name: "All organizations" }).click()
      await selectOrganization(
        studentPage,
        "University of Helsinki, Department of Mathematics and Statistics",
      )
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.getByText("Chapter 1 - Lockable").click()
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 1")
      await selectCourseInstanceIfPrompted(studentPage)
    })

    await test.step("Verify first yellow box is visible in unlocked chapter", async () => {
      await expect(
        studentPage.getByText(
          "You will not receive points for this exercise until you lock the chapter and a teacher reviews your answer.",
        ),
      ).toBeVisible()
    })

    await test.step("Lock chapter", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await studentPage.getByText("Chapter 1 - Lockable").click()
      await clickPageInChapterByTitle(studentPage, "Lock Chapter Page")
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.getByRole("button", { name: "Lock Chapter" }).click()
      await studentPage.getByRole("button", { name: "Confirm" }).click()
      await studentPage.getByText("Chapter locked").waitFor()
    })

    await test.step("Verify first yellow box is hidden when chapter is locked", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await studentPage.getByText("Chapter 1 - Lockable").click()
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
      ).toBeVisible()
    })

    await test.step("Note: Manual review message would be shown if exercise is in manual review state", async () => {
      await expect(
        studentPage
          .getByText("The current chapter is locked, and you can no longer submit exercises.")
          .first(),
      ).toBeVisible()
    })
  })
})
