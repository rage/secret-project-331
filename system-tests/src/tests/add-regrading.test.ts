import { expect, test } from "@playwright/test"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("test", async ({ page }) => {
  await page.goto("http://project-331.local/manage/regradings")
  await page.locator("text=New regrading").click()
  await page.locator('textarea[name="exerciseTaskSubmissionIds"]').click()
  await page.locator('textarea[name="exerciseTaskSubmissionIds"]').click()
  await page
    .locator('textarea[name="exerciseTaskSubmissionIds"]')
    .fill(" 9815985c-5123-5dbb-90a2-87b3693cc381")
  await page.locator('button:has-text("Create")').click()
  await page.locator("text=Operation successful!").waitFor()
  await page.locator("text=/ 1 Submissions regraded").waitFor()
  expect(page).toHaveURL(/http:\/\/project-331\.local\/manage\/regradings\/.+/)

  const firstRegradingPageUrl = page.url()

  // Check that we can create a regrading with multiple exercise task submissions
  await page.goto("http://project-331.local/manage/regradings")
  await page.locator("text=New regrading").click()
  await page.locator('textarea[name="exerciseTaskSubmissionIds"]').click()
  await page.locator('textarea[name="exerciseTaskSubmissionIds"]').click()

  await page
    .locator('textarea[name="exerciseTaskSubmissionIds"]')
    .fill(
      "  efac3f7f-e249-597e-9f4e-c6969174f3a7\n ae3c539a-7b08-52e8-a8f2-63981114110d\n b851259a-c44f-54c4-8ef1-38567cba1b7b\n e2e066f2-4bc2-5865-ac9b-4290f7db572a\n 479586aa-11c0-5afc-88ea-7b0ddcaf8d0f\n e7c6d14b-ce4c-5f1b-a855-0e4fd0fb3cb2\n   01c9942b-1fdf-58c2-81a0-7e52eb322a81\n   70353c1f-b75d-55a6-a70f-099707d8e650\n aa9ef303-9eed-53c9-b0d1-a08bade9f8fd  ",
    )
  await page.locator('button:has-text("Create")').click()
  await page.locator("text=regrading_started_at").waitFor()

  // Finally, check if the first regrading has completed
  await page.goto(firstRegradingPageUrl)
  // Long timeout to make sure the regrader has actually had the opportunity to run
  await page.locator(`text=total_grading_progress: FullyGraded`).waitFor({ timeout: 15_000 })
})
