import { expect } from "@playwright/test"
import type { Locator, Page } from "playwright"

import { LOADING_SPINNER_TEST_ID } from "@/shared-module/common/utils/constants"

/**
 * Builds the selector that matches the nth exercise service `<iframe>` element by its `src`.
 * Shared by the helpers that look inside the frame and the ones that target the frame element itself.
 */
function exerciseServiceIframeSelector(exerciseServiceSlug: string, n: number): string {
  return `:nth-match(iframe[src*="http://project-331.local/${exerciseServiceSlug}/iframe"], ${n})`
}

/**
 * Helper function to help interacting with exercise service iframes in the tests.
 * @param page Current page in the test
 * @param exerciseServiceSlug the exercise service slug, used to filter the iframes. E.g. "example-exercise" or "quizzes".
 * @param n Nth match to get selected. Starts from 1.
 * @returns Locator that can be used to find stuff inside iframes and also can be used to take a screenshot of the whole iframe.
 */
export async function getLocatorForNthExerciseServiceIframe(
  page: Page,
  exerciseServiceSlug: string,
  n: number,
) {
  const locatorForLocatingInsideIFrame = page.frameLocator(
    exerciseServiceIframeSelector(exerciseServiceSlug, n),
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
 * Returns a locator for the exercise service `<iframe>` **element** in the parent page (as opposed
 * to {@link getLocatorForNthExerciseServiceIframe}, which returns a locator for the `body` *inside*
 * the frame). Useful for asserting on the frame element itself, e.g. waiting for its height to settle.
 *
 * @param page Current page in the test
 * @param exerciseServiceSlug the exercise service slug, e.g. "example-exercise" or "quizzes".
 * @param n Nth match to get selected. Starts from 1.
 */
export function getLocatorForNthExerciseServiceIframeElement(
  page: Page,
  exerciseServiceSlug: string,
  n: number,
): Locator {
  return page.locator(exerciseServiceIframeSelector(exerciseServiceSlug, n))
}

/**
 * Waits until an exercise service iframe has stopped resizing.
 *
 * Exercise iframes measure their own content and report the height to the parent, which writes it to
 * the `<iframe>` element's height and `data-iframe-height` attribute on every change (see
 * `MessageChannelIFrame`). After a view switch or after adding content the height arrives as a burst
 * of messages, so the frame keeps growing for a few frames. Clicking inside the frame during that
 * window is racy: the frame (and everything in it) is still moving, so a click can miss its target
 * even though Playwright considers the inner element "stable" — Playwright's stability check runs in
 * the frame's own coordinate space and cannot see the cross-frame resize.
 *
 * This polls the height the parent reported via `data-iframe-height` until it is BOTH unchanged
 * between two consecutive checks (spaced `pollIntervalMs` apart so a brief pause mid-burst is not
 * mistaken for "settled") AND at least `minHeightPx` tall. The minimum guards against treating the
 * freshly-created, not-yet-sized iframe (which starts at `0px`) — or a transient sub-content height
 * during layout — as already settled. Reading the attribute (rather than `boundingBox()`) also works
 * when the iframe is scrolled out of view.
 *
 * @param page Current page in the test
 * @param exerciseServiceSlug the exercise service slug, e.g. "example-exercise" or "quizzes".
 * @param n Nth match to wait for. Starts from 1.
 */
export async function waitForExerciseServiceIframeToBeStable(
  page: Page,
  exerciseServiceSlug: string,
  n: number,
  {
    minHeightPx = 5,
    pollIntervalMs = 500,
    timeout = 15000,
  }: { minHeightPx?: number; pollIntervalMs?: number; timeout?: number } = {},
): Promise<void> {
  const iframeElement = getLocatorForNthExerciseServiceIframeElement(page, exerciseServiceSlug, n)
  let previousHeight: number | null = null
  await expect
    .poll(
      async () => {
        const rawHeight = await iframeElement.getAttribute("data-iframe-height")
        const height = rawHeight === null ? NaN : Number(rawHeight)
        if (!Number.isFinite(height) || height < minHeightPx) {
          // Not sized yet (or too small to hold real content): reset so we don't count it as stable.
          previousHeight = null
          return false
        }
        const isStable = previousHeight !== null && height === previousHeight
        previousHeight = height
        return isStable
      },
      // Longer gaps between reads so two equal samples mean the resize burst has actually finished,
      // not just paused between two quick polls.
      { intervals: [pollIntervalMs], timeout },
    )
    .toBe(true)
}

/**
 * If the locator is inside an iframe, scrolls the iframe to the view. Sometimes needed for making locators working inside the iframe to work.
 */
export async function scrollLocatorsParentIframeToViewIfNeeded(locator: Locator) {
  const page = locator.page()
  // We must wait here to counteract the automatic scrolling we do in `makeSureComponentStaysVisibleAfterChangingView`
  // oxlint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(550)
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
  const elementHandleBoundingBox = await elementHandle?.boundingBox()
  if (elementHandleBoundingBox === null || elementHandleBoundingBox === undefined) {
    throw new Error("Could not get bounding box for element handle")
  }
  await page.evaluate((y) => {
    const viewPortHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
    window.scrollTo(0, window.scrollY + y - viewPortHeight / 2)
  }, elementHandleBoundingBox.y)
}

/**
 * Waits for an exercise service IFrame to show a specific view type.
 *
 * @param locator - A locator that points to an exercise service IFrame. Please use the `getLocatorForNthExerciseServiceIframe` function to get the locator.
 * @param viewType - The type of view to wait for. Can be one of "answer-exercise", "view-submission", or "exercise-editor".
 */
export async function waitForViewType(
  locator: Locator,
  viewType: "answer-exercise" | "view-submission" | "exercise-editor",
) {
  await locator.locator(`[data-view-type="${viewType}"]`).waitFor()
}

/**
 * Waits until all MessageChannelIFrame instances have received state and a reasonable height.
 */
export async function waitForMessageChannelIframesToBeReady(page: Page, minHeightPx = 20) {
  const iframeLocator = page.getByTestId("message-channel-iframe")
  if ((await iframeLocator.count()) === 0) {
    return
  }
  await expect(async () => {
    const iframeCount = await iframeLocator.count()
    for (let index = 0; index < iframeCount; index++) {
      const nthIframe = iframeLocator.nth(index)
      const stateSent = await nthIframe.getAttribute("data-state-sent")
      if (stateSent !== "true") {
        throw new Error(`MessageChannelIFrame ${index + 1} has not received set-state`)
      }
      const spinnerCount = await page
        .frameLocator(`:nth-match(iframe[data-testid="message-channel-iframe"], ${index + 1})`)
        .getByTestId(LOADING_SPINNER_TEST_ID)
        .count()
      if (spinnerCount > 0) {
        throw new Error(`MessageChannelIFrame ${index + 1} still has a spinner`)
      }
      const iframeHeightValue = await nthIframe.getAttribute("data-iframe-height")
      const iframeHeight = iframeHeightValue ? Number(iframeHeightValue) : NaN
      if (!Number.isFinite(iframeHeight) || iframeHeight <= minHeightPx) {
        throw new Error(
          `MessageChannelIFrame ${index + 1} height is ${iframeHeightValue ?? "missing"} (min ${minHeightPx})`,
        )
      }
    }
  }).toPass({ timeout: 10000 })
}

export async function scrollToLocatorsParentIframeAndClick(locator: Locator) {
  await scrollLocatorsParentIframeToViewIfNeeded(locator)
  await locator.click()
}
