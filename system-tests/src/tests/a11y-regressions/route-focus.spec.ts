import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"

test.use({ storageState: "src/states/user@example.com.json" })

const COURSE = "http://project-331.local/org/uh-mathstat/courses/accessibility-course"

test("Chapter to a page without an h1 does not leave focus on main", async ({ page }) => {
  await page.goto(`${COURSE}/chapter-1`)
  await selectCourseInstanceIfPrompted(page)
  await page.getByRole("link", { name: "Flip Card" }).click()
  await expect(page).toHaveURL(/flip-card/)
  // oxlint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(3500)
  const activeTag = await page.evaluate(() => document.activeElement?.tagName)
  expect(activeTag).toMatch(/^H[1-6]$/)
})
