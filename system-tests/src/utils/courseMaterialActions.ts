import { Page } from "playwright"

const isSelectCourseInstanceModalOpen = async (page: Page) => {
  const courseVariantSelector = await page.$$("text=Select course instance to continue.")
  return courseVariantSelector.length > 0
}

/** Waits a moment in case the select course instance modal opens, and if opened, selects a course instance.
 *
 * This should be used instead of `await page.click('button:has-text("Continue")')`. This is because we might have other system tests that use the same course with the same user and this function makes sure those tests don't race with each other.
 */
export async function selectCourseInstanceIfPrompted(page: Page, courseVariantName = "default") {
  // Give a moment for the dialog to appear
  if (!(await isSelectCourseInstanceModalOpen(page))) {
    await page.waitForTimeout(200)
    if (!(await isSelectCourseInstanceModalOpen(page))) {
      await page.waitForTimeout(200)
    }
  }

  if (await isSelectCourseInstanceModalOpen(page)) {
    await page.click(`label:has-text("${courseVariantName}")`)

    // Click button:has-text("Continue")
    await page.click('button:has-text("Continue")')
    await page.locator(`text=Select course instance to continue.`).waitFor({ state: "detached" })
  }
}
