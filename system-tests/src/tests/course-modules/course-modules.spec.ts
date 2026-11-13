import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"

import accessibilityCheck from "../../utils/accessibilityCheck"

/** The edit form's chapter pickers are listbox selects, not native `<select>` elements. */
const pickChapter = async (page: Page, triggerId: string, chapter: string) => {
  await page.locator(triggerId).click()
  await page.getByRole("option", { name: chapter, exact: true }).click()
}

/** Fills the course code, credits and registration link a module form needs before it can be submitted. */
const fillCreditFields = async (form: Locator, courseCode: string) => {
  await form.getByRole("textbox", { name: "Course code", exact: true }).fill(courseCode)
  await form.getByRole("textbox", { name: "Credits (ECTS)", exact: true }).fill("5")
  await form
    .getByRole("textbox", { name: "Registration link", exact: true })
    .fill("https://example.com/register")
  await form.page().keyboard.press("Tab")
}

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Course modules test", async ({ page }) => {
  test.slow()
  // navigate to module page
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Computer Science")
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")
  await page.locator("[aria-label=\"Manage course \\'Course Modules\\'\"] path").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/edaa1c52-15cd-458d-8ce2-1e4010641244/overview",
  )
  await page.getByRole("tab", { name: "Modules" }).click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/edaa1c52-15cd-458d-8ce2-1e4010641244/modules",
  )
  await expect(page.getByRole("heading", { name: "Modules" })).toBeVisible()
  await accessibilityCheck(page, "Module management page")

  // delete a module
  await page.locator('[aria-label="Delete"]').first().click()
  await accessibilityCheck(page, "Module management page after deletion")

  // reset deletion
  await page.getByText("Reset").click()
  await accessibilityCheck(page, "Module management page after reset")

  // create invalid module
  await page.getByRole("button", { name: "Add a module" }).click()
  await page.getByRole("textbox", { name: "Name of module" }).fill("invalid module")
  await pickChapter(page, "#new-module-start", "2")
  await pickChapter(page, "#new-module-ends", "3")
  await fillCreditFields(
    page.getByRole("button", { name: "Create module" }).locator("xpath=ancestor::form[1]"),
    "TEST003",
  )
  await page.getByRole("button", { name: "Create module" }).click()
  await page.getByText("Error: Default module has missing chapters between 1 and 4").waitFor()

  // update invalid module to be valid
  await page.getByRole("button", { name: "Edit" }).nth(1).click()
  await page.getByRole("textbox", { name: "Edit module" }).fill("valid module")
  await pickChapter(page, "#editing-module-ends", "4")
  await page.getByRole("button", { name: "Done" }).click()
  await page
    .getByText("Error: Default module has missing chapters between 1 and 4")
    .waitFor({ state: "hidden" })

  // delete module
  await page.locator('[aria-label="Delete"]').nth(1).click()

  // update last module
  await page.getByRole("button", { name: "Edit" }).nth(2).click()
  await page.getByRole("textbox", { name: "Edit module" }).fill("renamed module")
  await pickChapter(page, "#editing-module-start", "3")
  await fillCreditFields(
    page.getByRole("button", { name: "Done" }).locator("xpath=ancestor::form[1]"),
    "TEST004",
  )
  await page.getByRole("button", { name: "Done" }).click()
  await page.getByText("2. renamed module").waitFor()

  // save changes
  await waitForSuccessNotification(page, async () => {
    await page.getByText("Save changes").click()
  })
})
