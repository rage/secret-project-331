import { expect, test } from "@playwright/test"

import { waitForSuccessNotification } from "@/utils/notificationUtils"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Teacher tries to generate description without default module course code", async ({
  page,
}) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Introduction to everything'" }).click()
  await expect(page.getByText("You need to set the default")).toBeVisible()
  await expect(page.getByText("Generate description for the")).toBeVisible()
  await expect(page.getByRole("button", { name: "Suggest description" })).toBeDisabled()
})

test("Teacher generates description and replaces original description", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Description" }).click()
  await page.getByRole("button", { name: "Suggest description" }).click()
  await expect(page.getByRole("textbox", { name: "AI generated description" })).toBeVisible()
  const ai_text = await page.getByRole("textbox", { name: "AI generated description" }).inputValue()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Replace description" }).click()
  })
  const replaced_description = await page.getByText("Description: Introductory").innerText()
  expect("Description: ".concat(ai_text)).toStrictEqual(replaced_description)
})

test("Teacher tries to generate description with only another module having course code", async ({
  page,
}) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Introduction to localizing'" }).click()
  await expect(page.getByText("You need to set the default")).toBeVisible()
  await expect(page.getByRole("button", { name: "Suggest description" })).toBeDisabled()
  await page.getByRole("tab", { name: "Modules" }).click()

  await page.locator("form").filter({ hasText: "1. Another module." }).getByLabel("Edit").click()
  await expect(
    page
      .locator("form")
      .filter({ hasText: "Edit module" })
      .getByPlaceholder("University of Helsinki course"),
  ).toHaveValue("TEST002")
  await page.locator("form").filter({ hasText: "Default module." }).getByLabel("Edit").click()
  await expect(
    page
      .locator("form")
      .filter({ hasText: "Default" })
      .getByPlaceholder("University of Helsinki course"),
  ).toHaveValue("")
})

test("Teacher can generate description after filling default module course code", async ({
  page,
}) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Introduction to localizing'" }).click()
  await expect(page.getByText("You need to set the default")).toBeVisible()
  await expect(page.getByText("Generate description for the")).toBeVisible()
  await expect(page.getByRole("button", { name: "Suggest description" })).toBeDisabled()
  await page.getByRole("tab", { name: "Modules" }).click()

  await page.locator("form").filter({ hasText: "Default module." }).getByLabel("Edit").click()
  await page
    .locator("form")
    .filter({ hasText: "Default" })
    .getByPlaceholder("University of Helsinki course")
    .fill("TEST001")
  await page.locator("form").filter({ hasText: "Default" }).getByLabel("Confirm").click()
  await page.getByRole("button", { name: "Save changes" }).click()
  await page.getByRole("tab", { name: "Overview" }).click()

  await page.getByRole("button", { name: "Suggest description" }).click()
  await expect(page.getByRole("textbox", { name: "AI generated description" })).toBeVisible()
  const ai_text = await page.getByRole("textbox", { name: "AI generated description" }).inputValue()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Replace description" }).click()
  })
  const replaced_description = await page.getByText("Description: Introductory").innerText()
  expect("Description: ".concat(ai_text)).toStrictEqual(replaced_description)
})

test("Teacher cannot generate description with invalid course code", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Automatic Completions'" }).click()
  await page.getByRole("button", { name: "Suggest description" }).click()
  await page.getByRole("heading", { name: "Could not generate description" }).waitFor()
  await expect(
    page.getByText(
      "Make sure that the given University of Helsinki course codes in modules are valid.",
    ),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Replace description" })).toBeDisabled()
})
