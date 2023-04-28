/* eslint-disable playwright/no-wait-for-timeout */
import { Page } from "playwright"

const isSelectCourseInstanceModalOpen = async (page: Page) => {
  // eslint-disable-next-line playwright/no-element-handle
  const courseVariantSelector = page.getByTestId("select-course-instance-heading")
  return courseVariantSelector.filter().isVisible()
}

/** Waits a moment in case the select course instance modal opens, and if opened, selects a course instance.
 *
 * This should be used instead of `await page.click('button:has-text("Continue")')`. This is because we might have other system tests that use the same course with the same user and this function makes sure those tests don't race with each other.
 */
export async function selectCourseInstanceIfPrompted(
  page: Page,
  courseVariantName?: string | undefined,
) {
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
    if (courseVariantName === undefined) {
      await page.getByTestId("default-course-instance-radiobutton").click()
    } else {
      await page.locator(`label:has-text("${courseVariantName}")`).click()
    }

    await page.getByTestId("select-course-instance-continue-button").click()
    await page.getByTestId("select-course-instance-heading").waitFor({ state: "detached" })
  }
}
