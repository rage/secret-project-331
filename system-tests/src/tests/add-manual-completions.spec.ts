import { expect, test } from "@playwright/test"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Teacher can manually add completions with validations", async ({ page }) => {
  await test.step("Navigate to the completions page", async () => {
    await page.goto(
      "http://project-331.local/manage/courses/86cbc198-601c-42f4-8e0f-3e6cce49bbfc/overview",
    )
    await page.getByRole("tab", { name: "Course instances" }).click()
    await page
      .getByTestId("course-instance-card")
      .filter({ hasText: "Non-default instance" })
      .getByRole("link", { name: "View completions" })
      .click()
  })

  await test.step("Open the add completions form", async () => {
    await page.getByRole("button", { name: "Manually add completions" }).click()
    await page.getByLabel("date").fill("2024-02-21")
  })

  await test.step("CSV missing required header", async () => {
    await page.getByRole("textbox", { name: "CSV" }).fill("grade\n3")
    await page.getByRole("button", { name: "Submit" }).click()
    await expect(page.locator("#maincontent")).toContainText(
      "CSV header row is missing, or it is invalid. Please check that the first row of your input follows the format specified in the instructions.",
    )
  })

  await test.step("Grade out of range", async () => {
    await page.getByLabel("date").fill("2024-02-21")
    await page
      .getByRole("textbox", { name: "CSV" })
      .fill("user_id,grade\nd7d6246c-45a8-4ff4-bf4d-31dedfaac159,6")
    await page.getByRole("button", { name: "Check" }).click()
    await expect(page.locator("#maincontent")).toContainText("Grade must be between 0 and 5")
  })

  await test.step("Invalid grade format", async () => {
    await page.getByLabel("date").fill("2024-02-21")
    await page
      .getByRole("textbox", { name: "CSV" })
      .fill("user_id,grade\nd7d6246c-45a8-4ff4-bf4d-31dedfaac159,excellent")
    await page.getByRole("button", { name: "Check" }).click()
    await expect(page.locator("#maincontent")).toContainText(
      "Grade must be a number between 0-5 or pass/fail",
    )
  })

  await test.step("Valid submission", async () => {
    await page.getByLabel("date").fill("2024-02-21")
    await page
      .getByRole("textbox", { name: "CSV" })
      .fill("user_id,grade\nd7d6246c-45a8-4ff4-bf4d-31dedfaac159,3")
    await page.getByRole("button", { name: "Check" }).click()
    await expect(page.locator("#maincontent")).toContainText(
      "Users receiving a completion for the first time (1)",
    )
    await page.getByRole("button", { name: "Submit" }).click()
    await expect(page.getByText("Completions submitted")).toBeVisible()
  })
})
