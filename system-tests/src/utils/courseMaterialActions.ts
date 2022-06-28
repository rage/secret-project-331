import { Page } from "playwright"

export async function selectCourseInstanceIfPrompted(page: Page, courseVariantName = "default") {
  // Give a moment for the dialog to appear
  await page.waitForTimeout(200)
  const courseVariantSelector = await page.$$("text=Select course instance to continue.")

  if (courseVariantSelector.length > 0) {
    await page.click(`label:has-text("${courseVariantName}")`)

    // Click button:has-text("Continue")
    await page.click('button:has-text("Continue")')
    await page.locator(`text=Select course instance to continue.`).waitFor({ state: "detached" })
  }
}
