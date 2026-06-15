import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import { signUp } from "@/utils/flows/signup.flow"

/**
 * The AI-usage / academic-integrity notice is shown once per user per course, right after the user
 * selects a course instance. A fresh user is created via signup so there is guaranteed to be no
 * prior enrollment or acknowledgement.
 */
test("AI-usage notice is shown after enrolling and must be acknowledged", async ({ page }) => {
  await test.step("Create a fresh user and enroll on a course", async () => {
    await signUp(page, {
      firstName: "AiNotice",
      lastName: "Tester",
      email: "ai-usage-notice-tester@example.com",
      password: "ai-usage-notice-tester",
      returnTo: "/org/uh-mathstat/courses/accessibility-course",
    })

    // Select the course instance but do NOT acknowledge the AI-usage notice, so the next step can
    // assert on it.
    await selectCourseInstanceIfPrompted(page, undefined, undefined, false)
  })

  await test.step("Notice appears and the confirm button is gated on the checkbox", async () => {
    const acknowledgeButton = page.getByTestId("ai-usage-notice-acknowledge-button")
    await acknowledgeButton.waitFor({ state: "visible" })

    // Disabled until the user confirms they have read and agree.
    await expect(acknowledgeButton).toBeDisabled()

    await page.getByTestId("ai-usage-notice-agree-checkbox").click()
    await expect(acknowledgeButton).toBeEnabled()

    await acknowledgeButton.click()
    await acknowledgeButton.waitFor({ state: "detached" })
  })

  await test.step("Notice does not reappear on reload", async () => {
    await page.reload()
    await page.locator(`.course-material-block`).first().waitFor({ state: "attached" })
    await expect(page.getByTestId("ai-usage-notice-acknowledge-button")).toHaveCount(0)
  })
})

/**
 * When a teacher selects an AI policy, the notice adapts: it shows the policy-specific text and,
 * because the course material is marked as containing its own AI instructions, points students to
 * those instructions instead of showing the general university-guidelines link.
 *
 * The course's policy is reset at the end so this test does not affect the default-message test above.
 */
test("AI-usage notice adapts to the teacher-selected policy", async ({ browser, page }) => {
  // Manage id of the seeded "Accessibility course".
  const courseManageUrl =
    "http://project-331.local/manage/courses/883c8ed0-08db-4cd1-a0a4-5cc79c69bdfe"

  const teacherContext = await browser.newContext({
    storageState: "src/states/teacher@example.com.json",
  })
  const teacherPage = await teacherContext.newPage()

  try {
    await test.step("Teacher sets a 'Limited' policy and marks the material as having AI instructions", async () => {
      await teacherPage.goto(courseManageUrl)
      await teacherPage.getByRole("button", { name: "Edit", exact: true }).click()
      const dialog = teacherPage.getByLabel("Edit course")
      await dialog.getByRole("radio", { name: "Yes", exact: true }).check()
      await dialog.getByRole("radio", { name: "Limited:" }).check()
      await teacherPage.getByRole("button", { name: "Update", exact: true }).click()
      await expect(teacherPage.getByText("Success", { exact: true })).toBeVisible()
    })

    await test.step("A fresh student sees the adapted notice and no guidelines link", async () => {
      await signUp(page, {
        firstName: "AiPolicy",
        lastName: "Tester",
        email: "ai-policy-notice-tester@example.com",
        password: "ai-policy-notice-tester",
        returnTo: "/org/uh-mathstat/courses/accessibility-course",
      })
      await selectCourseInstanceIfPrompted(page, undefined, undefined, false)

      await page.getByTestId("ai-usage-notice-acknowledge-button").waitFor({ state: "visible" })
      // Policy-specific paragraph for "Limited".
      await expect(page.getByText("use AI only for specific tasks")).toBeVisible()
      // Points to the course material as the source of the exact policy...
      await expect(
        page.getByText("The exact rules for using AI on this course are in the course material"),
      ).toBeVisible()
      // ...and therefore does not show the general university-guidelines link.
      await expect(page.getByRole("link", { name: /guidelines/i })).toHaveCount(0)
    })
  } finally {
    await test.step("Reset the course AI policy to the default", async () => {
      await teacherPage.goto(courseManageUrl)
      await teacherPage.getByRole("button", { name: "Edit", exact: true }).click()
      const dialog = teacherPage.getByLabel("Edit course")
      await dialog.getByRole("radio", { name: "Unknown", exact: true }).check()
      await dialog.getByRole("radio", { name: "Not set" }).check()
      await teacherPage.getByRole("button", { name: "Update", exact: true }).click()
      await expect(teacherPage.getByText("Success", { exact: true })).toBeVisible()
    })

    await teacherContext.close()
  }
})
