import { expect, test } from "@playwright/test"

/**
 * The AI-usage / academic-integrity notice is shown once per user per course, right after the user
 * selects a course instance. A fresh user is created via signup so there is guaranteed to be no
 * prior enrollment or acknowledgement.
 */
test("AI-usage notice is shown after enrolling and must be acknowledged", async ({ page }) => {
  await test.step("Create a fresh user and enroll on a course", async () => {
    await page.goto(
      "http://project-331.local/signup?return_to=%2Forg%2Fuh-mathstat%2Fcourses%2Faccessibility-course&lang=en-US",
    )
    await page.getByRole("textbox", { name: "First name (Required)" }).fill("AiNotice")
    await page.getByRole("textbox", { name: "Last name (Required)" }).fill("Tester")
    await page.getByRole("button", { name: "Select an item Where do you" }).click()
    await page.getByRole("option", { name: "Andorra" }).click()
    await page
      .getByRole("textbox", { name: "Email (Required)" })
      .fill("ai-usage-notice-tester@example.com")
    await page
      .getByRole("textbox", { name: "Password (Required)", exact: true })
      .fill("ai-usage-notice-tester")
    await page
      .getByRole("textbox", { name: "Confirm password (Required)" })
      .fill("ai-usage-notice-tester")

    await page.getByRole("button", { name: "Create an account" }).click()
    await expect(page.getByText("Success", { exact: true })).toBeVisible()

    // Select the course instance (do NOT use selectCourseInstanceIfPrompted here, since that helper
    // would also dismiss the notice we want to assert).
    await page.getByTestId("select-course-instance-heading").waitFor({ state: "attached" })
    await page.getByTestId("default-course-instance-radiobutton").click()
    await page.getByTestId("select-course-instance-continue-button").click()
    await page.getByTestId("select-course-instance-heading").waitFor({ state: "detached" })
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
