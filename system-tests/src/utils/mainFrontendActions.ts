import { Page } from "playwright"

export async function goToPageIfAvailable(page: Page, pageNumber: number) {
  // Give a moment for the page to appear
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(100)
  // eslint-disable-next-line playwright/no-element-handle
  const pageButtonSelector = await page.$$(`[aria-label="Go to page ${pageNumber}"]`)

  if (pageButtonSelector.length === 0) {
    return
  }
  await pageButtonSelector[0].click()
}
