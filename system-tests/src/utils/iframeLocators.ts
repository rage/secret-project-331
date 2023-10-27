import { expect } from "@playwright/test"
import { Locator, Page } from "playwright"
/**
 * Helper function to help interacting with exercise service iframes in the tests.
 * @param page Current page in the test
 * @param exerciseServiceSlug the exercise service slug, used to filter the iframes. E.g. "example-exercise" or "quizzes".
 * @param n Nth match to get selected
 * @returns Locator that can be used to find stuff inside iframes and also can be used to take a screenshot of the whole iframe.
 */
export async function getLocatorForNthExerciseServiceIframe(
  page: Page,
  exerciseServiceSlug: string,
  n: number,
) {
  const locatorForLocatingInsideIFrame = page.frameLocator(
    `:nth-match(iframe[src*="http://project-331.local/${exerciseServiceSlug}/iframe"], ${n})`,
  )

  // Assuming all iframes have one body tag. This way we can use the same locator for a) finding stuff inside iframes and b) taking screenshots of the frames.
  const iframeBodyLocator = locatorForLocatingInsideIFrame.locator("body")
  // Logic to make getting element handles from inside iframes that are offscreen to work
  await expect(async () => {
    const elementHandle = await iframeBodyLocator.elementHandle({ timeout: 500 })
    if (elementHandle === null) {
      throw new Error("Could not get element handle for locator")
    }
  }).toPass({ timeout: 10000 })
  return iframeBodyLocator
}

/**
 * If the locator is inside an iframe, scrolls the iframe to the view. Sometimes needed for making locators working inside the iframe to work.
 */
export async function scrollLocatorsParentIframeToViewIfNeeded(locator: Locator) {
  // Logic to make getting element handles from inside iframes that are offscreen to work
  await expect(async () => {
    const elementHandle = await locator.elementHandle({ timeout: 500 })
    if (elementHandle === null) {
      throw new Error("Could not get element handle for locator")
    }
  }).toPass({ timeout: 10000 })
  const elementHandle = await locator.elementHandle()
  const ownerFrame = await elementHandle?.ownerFrame()
  const parentFrame = ownerFrame?.parentFrame()
  // Try to scroll the element to view so that the stable check can pass
  if (ownerFrame && parentFrame !== null) {
    // Inside iframe, try to scroll that to view, since scrolling to selectors inside iframes don't seem to work
    const frameElement = await ownerFrame?.frameElement()
    await frameElement?.scrollIntoViewIfNeeded()
  } else {
    elementHandle?.scrollIntoViewIfNeeded()
  }
}

export async function scrollElementInsideIframeToView(locator: Locator) {
  const page = locator.page()
  // Logic to make getting element handles from inside iframes that are offscreen to work
  await expect(async () => {
    const elementHandle = await locator.elementHandle({ timeout: 500 })
    if (elementHandle === null) {
      throw new Error("Could not get element handle for locator")
    }
  }).toPass({ timeout: 10000 })
  const elementHandle = await locator.elementHandle()
  const ownerFrame = await elementHandle?.ownerFrame()
  const parentFrame = ownerFrame?.parentFrame()
  const elementHandleBoundingBox = await elementHandle?.boundingBox()
  if (elementHandleBoundingBox === null || elementHandleBoundingBox === undefined) {
    throw new Error("Could not get bounding box for element handle")
  }
  await page.evaluate((y) => {
    window.scrollTo(0, window.scrollY + y)
  }, elementHandleBoundingBox.y)
}
