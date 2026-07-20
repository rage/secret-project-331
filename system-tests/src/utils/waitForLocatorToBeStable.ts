import { expect, type Locator } from "@playwright/test"

/**
 * Waits for a locator to be "stable" (stop moving/resizing) without scrolling it into view.
 *
 * Playwright only exposes the Stable actionability check through actions such as `click()` or
 * `scrollIntoViewIfNeeded()` (the latter scrolls). When you need to wait for an element to settle
 * but must not scroll, poll its bounding box until it is unchanged between two checks — this mirrors
 * Playwright's own definition of Stable (same bounding box across consecutive frames).
 * `boundingBox()` does not scroll the element into view.
 */
export const waitForLocatorToBeStable = async (locator: Locator): Promise<void> => {
  let previousBox: { x: number; y: number; width: number; height: number } | null = null
  await expect
    .poll(async () => {
      const box = await locator.boundingBox()
      const isStable =
        box !== null &&
        previousBox !== null &&
        box.x === previousBox.x &&
        box.y === previousBox.y &&
        box.width === previousBox.width &&
        box.height === previousBox.height
      previousBox = box
      return isStable
    })
    .toBe(true)
}
