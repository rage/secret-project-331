/* eslint-disable playwright/no-wait-for-timeout */
import { test } from "@playwright/test"
import { Page } from "playwright"

const isCourseSettingsModalOpen = async (page: Page) => {
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
  await test.step(
    "Select course instance if prompted",
    async () => {
      // Wait until some blocks have rendered on the page. This is to make sure the page has actually loaded. Would not work on pages with no blocks.
      await page.locator(`.course-material-block`).first().waitFor({ state: "attached" })
      // Give a moment for the dialog to appear
      if (!(await isCourseSettingsModalOpen(page))) {
        await page.waitForTimeout(100)
        if (!(await isCourseSettingsModalOpen(page))) {
          await page.waitForTimeout(100)
        }
      }

      if (await isCourseSettingsModalOpen(page)) {
        if (courseVariantName === undefined) {
          await page.getByTestId("default-course-instance-radiobutton").click()
        } else {
          await page.locator(`label:has-text("${courseVariantName}")`).click()
        }

        await page.getByTestId("select-course-instance-continue-button").click()
        await page.getByTestId("select-course-instance-heading").waitFor({ state: "detached" })
      }
    },
    { box: true },
  )
}

/** Navigates to the next page and verifies the page has actually changed.
 *
 * This function clicks the "Next page" link and waits for the URL to change,
 * ensuring that the navigation was successful and the page has actually loaded.
 * If the page hasn't changed after a short while, it retries the click.
 */
export async function navigateToNextPageInMaterial(page: Page) {
  await test.step(
    "Navigate to next page",
    async () => {
      // Find the next page link
      const nextPageLink = page.getByRole("link", { name: /Next page:/ })

      // Get the current URL before navigation
      const originalUrl = page.url()

      // Scroll the link into view and click it
      await nextPageLink.scrollIntoViewIfNeeded()
      await page.waitForTimeout(100)
      await nextPageLink.click()

      // Wait for the URL to change, indicating the page has actually navigated
      let urlChanged = false
      let attempts = 0
      const maxAttempts = 3

      while (!urlChanged && attempts < maxAttempts) {
        try {
          await page.waitForFunction(
            (originalUrl) => window.location.href !== originalUrl,
            originalUrl,
            { timeout: 3000 },
          )
          urlChanged = true
        } catch (error) {
          console.warn("Failed to navigate to next page, retrying...", error)
          attempts++
          if (attempts < maxAttempts) {
            // If URL hasn't changed, try clicking again
            await nextPageLink.click()
          } else {
            throw new Error(`Failed to navigate to next page after ${maxAttempts} attempts`)
          }
        }
      }
    },
    { box: true },
  )
}
