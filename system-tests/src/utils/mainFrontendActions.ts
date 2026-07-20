import type { Page } from "playwright"

export async function goToPageIfAvailable(page: Page, pageNumber: number) {
  // Give a moment for the page to appear
  // oxlint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(100)
  // oxlint-disable-next-line playwright/no-element-handle
  const pageButtonSelector = await page.$$(`[aria-label="Go to page ${pageNumber}"]`)

  if (pageButtonSelector.length === 0) {
    return
  }
  // safe: length is non-zero here (early return above when empty)
  await pageButtonSelector[0]!.click()
}
