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
  if (scrollableContainer) {
    await scrollableContainer.evaluate((el) => {
      if (el) {
        el.scrollTop = el.scrollHeight
      }
    })
  }
}
