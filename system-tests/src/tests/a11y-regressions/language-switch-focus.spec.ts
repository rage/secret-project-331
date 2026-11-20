import { expect, test } from "@playwright/test"

import { ChapterSelector } from "../../utils/components/ChapterSelector"
import { Topbar } from "../../utils/components/Topbar"
import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { activeElementAfterRouteFocus } from "../../utils/routeFocus"

test.use({ storageState: "src/states/user@example.com.json" })

test("Switching the course language does not leave focus on main or body", async ({ page }) => {
  await page.goto("http://project-331.local/org/uh-mathstat/courses/change-language-course")
  await selectCourseInstanceIfPrompted(page)
  await new ChapterSelector(page).clickChapter(1)
  await page.getByRole("link", { name: "2 Page 2" }).click()
  await page.getByText("First chapters second page.").click()

  await new Topbar(page).languageMenu.clickItem("Suomi")
  await expect(page).toHaveURL(/vaihda-kurssin-kieli\/chapter-1\/page-2/)
  const active = await activeElementAfterRouteFocus(page)
  expect(active.tag).not.toBe("BODY")
  expect(active.mainIsFocused).toBe(false)
})
