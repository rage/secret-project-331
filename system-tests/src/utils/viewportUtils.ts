import { test } from "@playwright/test"
import { Page } from "playwright"

/**
 * Temporarily sets the viewport size, executes a callback, and restores the original viewport size.
 * Uses try-finally to ensure the viewport is always restored even if the callback throws.
 *
 * @param page - The Playwright page object
 * @param viewportSize - The viewport size to set (width and height)
 * @param callback - The async callback to execute with the new viewport size
 * @returns The result of the callback
 */
export async function withViewportSize<T>(
  page: Page,
  viewportSize: { width: number; height: number },
  callback: () => Promise<T>,
): Promise<T> {
  return await test.step(`With viewport size ${viewportSize.width}x${viewportSize.height}`, async () => {
    const originalViewport = page.viewportSize()
    try {
      await page.setViewportSize(viewportSize)
      return await callback()
    } finally {
      // eslint-disable-next-line playwright/no-conditional-in-test
      if (originalViewport) {
        await page.setViewportSize(originalViewport)
      }
    }
  })
}
