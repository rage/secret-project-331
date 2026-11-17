import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"

test.use({
  browserName: "firefox",
  storageState: "src/states/user@example.com.json",
})

test("Enter on Give feedback opens the type dialog again after it was closed", async ({ page }) => {
  await page.goto(
    "http://project-331.local/org/uh-mathstat/courses/accessibility-course/chapter-1/flip-card",
  )
  await selectCourseInstanceIfPrompted(page)

  const trigger = page.getByRole("button", { name: "Give feedback" })
  await trigger.focus()
  for (const closeKey of ["Escape", "Escape"]) {
    await page.keyboard.press("Enter")
    await expect(page.getByRole("dialog", { name: "Select feedback type" })).toBeVisible()
    await page.keyboard.press(closeKey)
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(trigger).toBeFocused()
  }
})
