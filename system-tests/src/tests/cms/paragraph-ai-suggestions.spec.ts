import { expect, test } from "@playwright/test"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

const COURSE_PAGES_URL =
  "http://project-331.local/manage/courses/7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5/pages"

test("Can get and accept paragraph AI suggestions", async ({ page }) => {
  await page.goto(COURSE_PAGES_URL)
  await page
    .getByRole("row", { name: /Page One/ })
    .getByRole("button", { name: "Edit page" })
    .click()

  await page.getByText("Everything is a big topic.").click()
  await page.getByRole("button", { name: "AI writing assistant" }).click()
  await page.getByRole("menuitem", { name: "Improve" }).click()
  await page.getByRole("menuitem", { name: "Fix spelling & grammar" }).click()

  const dialogLocator = page.getByRole("dialog")
  await expect(dialogLocator.getByText("Everything is a big topic.")).toBeVisible()

  await expect(page.getByText("Suggestion 1").first()).toBeVisible()
  await page.getByText("Suggestion 1").first().click()
  await page.getByRole("button", { name: "Yes" }).click()
  await dialogLocator.waitFor({ state: "hidden" })

  await expect(page.getByText("Mock suggestion 1: The paragraph has been improved.")).toBeVisible()
})
