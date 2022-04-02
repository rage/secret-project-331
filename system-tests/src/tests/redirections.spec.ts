import { expect, test } from "@playwright/test"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Redirection redirects to the new url", async ({ page }) => {
  await page.goto("http://project-331.local/org/uh-cs/courses/redirections/old-url")
  await page.waitForTimeout(100)
  expect(page).toHaveURL(`http://project-331.local/org/uh-cs/courses/redirections/chapter-1/page-2`)
})
