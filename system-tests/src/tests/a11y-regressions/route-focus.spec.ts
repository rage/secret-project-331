import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { activeElementAfterRouteFocus } from "../../utils/routeFocus"

test.use({ storageState: "src/states/user@example.com.json" })

const COURSE = "http://project-331.local/org/uh-mathstat/courses/accessibility-course"

test("Chapter to a page without an h1 does not leave focus on main", async ({ page }) => {
  await page.goto(`${COURSE}/chapter-1`)
  await selectCourseInstanceIfPrompted(page)
  await page.getByRole("link", { name: "Flip Card" }).click()
  await expect(page).toHaveURL(/flip-card/)
  const { tag } = await activeElementAfterRouteFocus(page)
  expect(tag).toMatch(/^H[1-6]$/)
})
