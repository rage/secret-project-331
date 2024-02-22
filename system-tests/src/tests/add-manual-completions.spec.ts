import { expect, test } from "@playwright/test"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Teacher can manually add completions", async ({ page }) => {
  await page.goto(
    "http://project-331.local/manage/courses/86cbc198-601c-42f4-8e0f-3e6cce49bbfc/overview",
  )
  await page.getByRole("tab", { name: "Course instances" }).click()
  await page
    .locator("li")
    .filter({ hasText: "Non-default instance Manage" })
    .getByLabel("View completions")
    .click()
  await page.getByRole("button", { name: "Manually add completions" }).click()
  await page.getByLabel("date").fill("2024-02-21")
  await page.getByPlaceholder("user_id[,grade][,").click()
  await page.getByPlaceholder("user_id[,grade][,").click()
  await page
    .getByPlaceholder("user_id[,grade][,")
    .fill("user_id,grade\nd7d6246c-45a8-4ff4-bf4d-31dedfaac159,3")
  await page.getByRole("button", { name: "Check" }).click()
  await expect(page.locator("#maincontent")).toContainText(
    "Users receiving a completion for the first time (1)",
  )
  await page.getByRole("button", { name: "Submit" }).click()
  await page.getByText("Completions submitted").click()
})
