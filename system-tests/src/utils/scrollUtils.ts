import { expect } from "@playwright/test"
import { Locator, Page } from "playwright"

/** Scrolls the page to the specified y coordinate */
export async function scrollToYCoordinate(page: Page, y: number) {
  await page.evaluate((y) => window.scrollTo(0, y), y)
}

/** Finds and scrolls the scrollable parent container of an element to the bottom */
export async function scrollElementContainerToBottom(element: Locator) {
  const scrollableContainer = await element.evaluateHandle((el) => {
    let current: Element | null = el
    while (current) {
      const style = window.getComputedStyle(current)
      const overflowY = style.overflowY || style.overflow
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        current.scrollHeight > current.clientHeight
      ) {
        return current
      }
      current = current.parentElement
    }
    return null
  })

  await expect(async () => {
    const result = await scrollableContainer.evaluate((el) => {
      if (!el) {
        return { isAtBottom: true, scrollTop: 0, maxScroll: 0 }
      }
      el.scrollTop = el.scrollHeight
      const maxScroll = el.scrollHeight - el.clientHeight
      const currentScroll = el.scrollTop
      const isScrolledToBottom = Math.abs(currentScroll - maxScroll) <= 1
      return { isAtBottom: isScrolledToBottom, scrollTop: currentScroll, maxScroll }
    })

    if (!result.isAtBottom) {
      // eslint-disable-next-line playwright/no-wait-for-timeout
      await element.page().waitForTimeout(100)
      throw new Error(
        `Container not scrolled to bottom yet. scrollTop: ${result.scrollTop}, maxScroll: ${result.maxScroll}`,
      )
    }
  }).toPass({ timeout: 5000 })

  await scrollableContainer.evaluate((el) => {
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  })

  // eslint-disable-next-line playwright/no-wait-for-timeout
  await element.page().waitForTimeout(200)
}
