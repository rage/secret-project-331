import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

const ADDITIONAL_MESSAGE = "THIS COURSE HAS CLOSED UNTIL FURTHER NOTICE"

test("Can close courses and shows warning dialog", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "All organizations" }).click()
  await page
    .getByLabel("University of Helsinki, Department of Mathematics and Statistics")
    .getByRole("button", { name: "Select" })
    .click()
  await page.getByRole("link", { name: "Manage course 'Closed course'" }).click()
  await page.getByRole("button", { name: "Edit" }).click()
  await page.getByRole("checkbox", { name: "Set course closed at" }).check()
  await page.getByRole("textbox", { name: "Closed at" }).fill("2025-01-01T13:15:03")
  await page.getByRole("textbox", { name: "Additional message on the" }).fill(ADDITIONAL_MESSAGE)
  await page
    .getByRole("textbox", { name: "Closed course successor" })
    .fill("3cbaac48-59c4-4e31-9d7e-1f51c017390d")
  await page.getByRole("button", { name: "Update" }).click()
  await page.getByText("Operation successful!").waitFor()
  await page.getByRole("button", { name: "Open course front page" }).click()
  await selectCourseInstanceIfPrompted(page)
  await page.getByText("This course has been closed").waitFor()
  await page.getByText("Additional information").waitFor()
  await page.getByText(ADDITIONAL_MESSAGE).waitFor()
  await page.getByText("New version of the course").click()
  expect(page.url()).toBe("http://project-331.local/org/uh-mathstat/courses/self-review")
})
