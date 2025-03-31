import { expect, test } from "@playwright/test"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("Feedback messages can contain markdown", async ({ page }) => {
  await page.goto("http://project-331.local/playground-tabs")
  await page
    .getByLabel("Service info URL", { exact: true })
    .fill("http://project-331.local/quizzes/api/service-info")
  await page.getByText("Valid service info").waitFor()
  await page.getByRole("button", { name: "Preview" }).click()
  const frameLocator = page.frameLocator('iframe[title="PLAYGROUND"]')
  await frameLocator.getByRole("button", { name: "Multiple choice Choose" }).click()
  await frameLocator.getByLabel("Option title", { exact: true }).fill("Correct")
  await frameLocator.getByLabel("Correct").check()
  await frameLocator.getByRole("button", { name: "Add option" }).click()
  await frameLocator.getByLabel("Option title", { exact: true }).fill("Incorrect")
  await frameLocator.getByRole("button", { name: "Add option" }).click()
  await frameLocator
    .locator("details")
    .filter({ hasText: "Advanced options Layout" })
    .locator("summary")
    .click()
  await frameLocator
    .getByLabel("Failure message", { exact: true })
    .fill("You're a [markdown]**failure**[/markdown].")
  await page.getByRole("button", { name: "Set as private spec input" }).click()
  await page.getByText("exercise-editoranswer-").click()
  await page.getByRole("button", { name: "answer-exercise" }).click()
  await frameLocator.getByRole("button", { name: "Incorrect" }).click()
  await page.getByRole("button", { name: "Submit" }).click()
  await page.getByRole("button", { name: "view-submission" }).click()
  await expect(frameLocator.locator("#exercise-service-content-id")).toContainText(
    "You're a failure.",
  )
  // Make sure the text is bold -> the markdown was rendered
  await frameLocator.locator('strong:text-is("failure")').waitFor()
})
