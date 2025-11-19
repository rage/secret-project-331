import { Page } from "playwright"

/** Scrolls the page to the specified y coordinate */
export async function scrollToYCoordinate(page: Page, y: number) {
  await page.evaluate((y) => window.scrollTo(0, y), y)
}
