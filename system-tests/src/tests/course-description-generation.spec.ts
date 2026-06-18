import { expect, test } from "@playwright/test"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("teacher tries to generate description without default module course code", async ({
  page,
}) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Introduction to everything'" }).click()
  await expect(page.getByText("You need to set the default")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Generate description for the" })).toBeVisible()
  await page.getByRole("button", { name: "Suggest description" }).isDisabled()
})

test("teacher_generates_description_and_replaces_original_description", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Description" }).click()
  await page.getByRole("button", { name: "Suggest description" }).click()
  await expect(page.getByRole("textbox", { name: "AI generated description" })).toBeVisible()
  const ai_text = await page.getByRole("textbox", { name: "AI generated description" }).inputValue()
  await page.getByRole("button", { name: "Replace description" }).click()
  const replaced_description = await page.getByText("Description: Introductory").innerText()
  expect("Description: ".concat(ai_text)).toStrictEqual(replaced_description)
})
