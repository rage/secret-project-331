import { expect, test } from "@playwright/test"

import { ComboBox } from "@/utils/components/ComboBox"
import { ADMIN_SET, languageVersionsTabUrl, problemRow } from "@/utils/languageVersions"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

// Owns the "admin" set; only reads it.
test.use({ storageState: "src/states/admin@example.com.json" })

test("The admin tool opens the language versions of the course picked by name", async ({
  page,
  headless,
}, testInfo) => {
  await page.goto("/")
  await page.getByRole("link", { name: "Language versions", exact: true }).click()
  await expect(page).toHaveURL("/manage/language-versions")
  await expect(page.getByRole("heading", { name: "Language versions", level: 1 })).toBeVisible()

  const picker = new ComboBox(page, page.getByRole("combobox", { name: "Course name or slug" }), {
    name: "Course",
  })
  await picker.filterOptions(ADMIN_SET.finnishSlug)
  await picker.chooseOption(`${ADMIN_SET.finnishName} (${ADMIN_SET.finnishSlug})`)
  await expect(page).toHaveURL(`/manage/language-versions?course=${ADMIN_SET.finnishCourseId}`)

  const courses = page.getByRole("table", { name: "Courses" })
  await expect(courses.getByRole("link", { name: ADMIN_SET.finnishName })).toBeVisible()
  await expect(courses.getByRole("link", { name: ADMIN_SET.swedishName })).toBeVisible()
  await expect(
    problemRow(page, "A course looks like a translation of this course but is a separate course"),
  ).toContainText(`“${ADMIN_SET.englishName}” (English)`)

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "language-versions-admin-tool",
    waitForTheseToBeVisibleAndStable: [courses],
    screenshotOptions: { mask: [page.locator("time")] },
  })

  await courses.getByRole("link", { name: ADMIN_SET.finnishName }).click()
  await page.getByRole("tab", { name: "Language versions" }).click()
  await expect(page).toHaveURL(languageVersionsTabUrl(ADMIN_SET.finnishCourseId))
})
