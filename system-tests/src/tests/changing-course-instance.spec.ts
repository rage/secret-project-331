import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import { openCourseSettingsFromQuickActions } from "@/utils/flows/topbar.flow"
import { selectOrganization } from "@/utils/organizationUtils"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("Changing course instance preserves completions and points", async ({ page }) => {
  await test.step("Open app and choose organization", async () => {
    await page.goto("http://project-331.local/")
    await page.getByRole("link", { name: "All organizations" }).click()
    await selectOrganization(
      page,
      "University of Helsinki, Department of Mathematics and Statistics",
    )
  })

  await test.step("Open course and navigate to first exercise", async () => {
    await page.getByRole("link", { name: "Navigate to course 'Changing course instance'" }).click()
    await selectCourseInstanceIfPrompted(page)
    await page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await page.getByRole("link", { name: "1 Page One" }).click()
  })

  await test.step("Complete exercise 1.1 and submit", async () => {
    await page
      .locator('iframe[title="Exercise 1, task 1 content"]')
      .contentFrame()
      .getByRole("checkbox", { name: "4" })
      .click()
    await page.getByRole("button", { name: "Submit" }).click()
    await page.getByText("Good job").waitFor()
    await page.getByTestId("exercise-points").click()
  })

  await test.step("Verify course overview shows passed", async () => {
    await page.getByRole("link", { name: "Changing course instance" }).click()
    await page.getByRole("heading", { name: "Congratulations!" }).click()
    await page.getByText("You have successfully").click()
    await page.getByRole("heading", { name: "Changing course instance" }).click()
    await page.getByLabel("Grade: Passed").locator("div").waitFor()
  })

  await test.step("Switch to non-default course instance", async () => {
    await openCourseSettingsFromQuickActions(page)
    await page.getByRole("radio", { name: "Non-default instance" }).check()
    await page.getByTestId("select-course-instance-continue-button").click()
    await page.getByTestId("select-course-instance-continue-button").waitFor({ state: "detached" })
    // eslint-disable-next-line playwright/no-networkidle
    await page.waitForLoadState("networkidle")
    await page.reload()
  })

  await test.step("Verify completions and points are preserved", async () => {
    await page.getByText("You have successfully").click()
    await page.getByRole("heading", { name: "Congratulations!" }).click()
    await page.getByRole("heading", { name: "Changing course instance" }).click()
    await page.getByLabel("Grade: Passed").waitFor()
    await page.getByText("1/1Points").waitFor()
    await page.getByText("1 / 1 Exercises attempted").waitFor()
  })
})
