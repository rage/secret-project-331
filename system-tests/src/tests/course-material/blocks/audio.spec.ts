import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Can upload audio files to pages", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "All organizations" }).click()
  await page.getByLabel("University of Helsinki, Department of Mathematics and Statistics").click()
  await page.getByLabel("Manage course 'Audio course'").click()
  await page.getByRole("tab", { name: "Pages" }).click()
  await page
    .getByRole("row", { name: "The Basics /chapter-1 Edit" })
    .getByLabel("Dropdown menu")
    .click()
  await page.getByRole("button", { name: "Upload audio file" }).click()
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator("#audioFile").click(),
  ])
  await fileChooser.setFiles("src/fixtures/media/audio.ogg")
  await page.getByRole("button", { name: "Upload" }).click()
  await page.getByText("Success").first().waitFor()
  await page.getByText("audio/ogg").waitFor()

  // Test that the player is there
  await page.goto("http://project-331.local/org/uh-mathstat/courses/audio-course")
  await selectCourseInstanceIfPrompted(page)
  await page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
  await page.getByRole("button", { name: "Listen" }).click()
  await page.getByText("00:00").first().waitFor()
})
