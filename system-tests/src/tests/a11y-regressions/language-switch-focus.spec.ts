import { expect, test } from "@playwright/test"

import { ChapterSelector } from "../../utils/components/ChapterSelector"
import { Topbar } from "../../utils/components/Topbar"
import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"

test.use({ storageState: "src/states/user@example.com.json" })

test("Switching the course language does not leave focus on main or body", async ({ page }) => {
  await page.goto("http://project-331.local/org/uh-mathstat/courses/change-language-course")
  await selectCourseInstanceIfPrompted(page)
  await new ChapterSelector(page).clickChapter(1)
  await page.getByRole("link", { name: "2 Page 2" }).click()
  await page.getByText("First chapters second page.").click()

  await new Topbar(page).languageMenu.clickItem("Suomi")
  await expect(page).toHaveURL(/vaihda-kurssin-kieli\/chapter-1\/page-2/)
  // oxlint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(3500)
  const active = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    mainIsFocused: document.activeElement === document.querySelector("main"),
    text: document.activeElement?.textContent?.slice(0, 40),
  }))
  expect(active.tag).not.toBe("BODY")
  expect(active.mainIsFocused).toBe(false)
})
