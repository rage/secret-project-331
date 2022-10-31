import { Page } from "playwright"

const isSelectCourseInstanceModalOpen = async (page: Page) => {
  const courseVariantSelector = await page.$$(`h2:has-text("Select course instance")`)
  return courseVariantSelector.length > 0
}

/** Waits a moment in case the select course instance modal opens, and if opened, selects a course instance.
 *
 * This should be used instead of `await page.click('button:has-text("Continue")')`. This is because we might have other system tests that use the same course with the same user and this function makes sure those tests don't race with each other.
 */
export async function selectCourseInstanceIfPrompted(page: Page, courseVariantName = "default") {
  // Wait until some blocks have rendered on the page. This is to make sure the page has actually loaded. Would not work on pages with no blocks.
  await page.locator(`.course-material-block`).first().waitFor({ state: "attached" })
  // Give a moment for the dialog to appear
  if (!(await isSelectCourseInstanceModalOpen(page))) {
    await page.waitForTimeout(100)
    if (!(await isSelectCourseInstanceModalOpen(page))) {
      await page.waitForTimeout(100)
    }
  }

  if (await isSelectCourseInstanceModalOpen(page)) {
    await page.click(`label:has-text("${courseVariantName}")`)

    // Click button:has-text("Continue")
    await page.click('button:has-text("Continue")')
    await page.locator(`h2:has-text("Select course instance")`).waitFor({ state: "detached" })
  }
}
