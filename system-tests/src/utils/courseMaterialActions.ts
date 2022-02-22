import { Page } from "playwright"

export async function selectCourseVariantIfPrompted(page: Page, courseVariantName = "default") {
  // Give a moment for the dialog to appear
  await page.waitForTimeout(100)
  const courseVariantSelector = await page.$$("text=Select course version to continue.")

  if (courseVariantSelector.length > 0) {
    await page.click(`label:has-text("${courseVariantName}")`)

    // Click button:has-text("Continue")
    await page.click('button:has-text("Continue")')
  }
}
