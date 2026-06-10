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
