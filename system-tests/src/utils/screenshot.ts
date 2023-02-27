import { ElementHandle, expect, Frame, Page, PageScreenshotOptions } from "@playwright/test"

import {
  HIDE_TEXT_IN_SYSTEM_TESTS_EVENT,
  SHOW_TEXT_IN_SYSTEM_TESTS_EVENT,
} from "../shared-module/utils/constants"

import accessibilityCheck from "./accessibilityCheck"

const viewPorts = {
  "small-desktop": { width: 1280, height: 720 },
  mobile: { width: 411, height: 731 },
}

/**
 * See https://playwright.dev/docs/test-assertions#screenshot-assertions-to-match-snapshot.
 *
 * The second argument passed to expect(screenshot).toMatchSnapshot(name[, options])
 */
type ToMatchSnapshotOptions = Parameters<ReturnType<typeof expect>["toMatchSnapshot"]>[0]

interface ExpectScreenshotsToMatchSnapshotsProps {
  headless: boolean | undefined
  snapshotName: string
  waitForThisToBeVisibleAndStable?: string | ElementHandle | (string | ElementHandle)[]
  clearNotifications?: boolean
  toMatchSnapshotOptions?: ToMatchSnapshotOptions
  beforeScreenshot?: () => Promise<void>
  page?: Page
  frame?: Frame
  elementId?: string
  pageScreenshotOptions?: PageScreenshotOptions
  axeSkip?: boolean | string[]
  skipMobile?: boolean
  /** If defined, the page will scroll to this y coordinate before taking the screenshot */
  scrollToYCoordinate?: number
  /** True by default. See the react component HideTextInSystemTests and the hook useShouldHideStuffFromSystemTestScreenshots on how to use this. */
  replaceSomePartsWithPlaceholders?: boolean
}

export default async function expectScreenshotsToMatchSnapshots({
  headless = false,
  snapshotName,
  toMatchSnapshotOptions = { threshold: 0.3 },
  waitForThisToBeVisibleAndStable,
  beforeScreenshot,
  frame,
  page,
  elementId,
  pageScreenshotOptions,
  clearNotifications = false,
  // keep false for new screenshots
  axeSkip = false,
  skipMobile = false,
  scrollToYCoordinate,
  replaceSomePartsWithPlaceholders = true,
}: ExpectScreenshotsToMatchSnapshotsProps): Promise<void> {
  let pageObjectToUse = page
  let visibilityWaitContainer: Page | Frame
  let originalViewPort = page?.viewportSize()
  if (frame) {
    pageObjectToUse = frame.page()
    originalViewPort = pageObjectToUse.viewportSize()
    visibilityWaitContainer = frame
  } else if (page) {
    visibilityWaitContainer = page
  } else {
    throw new Error("No page or frame provided to expectScreenshotsToMatchSnapshots")
  }

  if (!pageObjectToUse) {
    throw new Error("Could not determine pageObjectToUse")
  }

  // if frame is passed, then we take a screenshot of the frame istead of the page
  if (frame) {
    const frameElement = await frame.frameElement()
    // The frame is not always visible, and waitForThisToBeVisibleAndStable won't work if the frame is not visible
    await frameElement.scrollIntoViewIfNeeded()
  }

  const elementHandle = await waitToBeVisible({
    waitForThisToBeVisibleAndStable: waitForThisToBeVisibleAndStable || [],
    container: visibilityWaitContainer,
    replaceSomePartsWithPlaceholders,
  })

  if (clearNotifications) {
    await (page || pageObjectToUse).evaluate(() => {
      for (const notif of Array.from(document.querySelectorAll("#give-feedback-button"))) {
        notif.remove()
      }
      for (const notif of Array.from(
        document.querySelectorAll<HTMLElement>(".toast-notification"),
      )) {
        notif.style.display = "none"
      }
    })
  }

  if (!skipMobile) {
    await snapshotWithViewPort({
      snapshotName,
      viewPortName: "mobile",
      toMatchSnapshotOptions,
      waitForThisToBeStable: elementHandle,
      beforeScreenshot,
      page,
      frame,
      elementId,
      headless,
      pageScreenshotOptions,
      axeSkip,
      scrollToYCoordinate,
      replaceSomePartsWithPlaceholders,
    })
  }

  await snapshotWithViewPort({
    snapshotName,
    viewPortName: "small-desktop",
    toMatchSnapshotOptions,
    waitForThisToBeStable: elementHandle,
    beforeScreenshot,
    page,
    frame,
    elementId,
    headless,
    pageScreenshotOptions,
    axeSkip,
    scrollToYCoordinate,
    replaceSomePartsWithPlaceholders,
  })

  if (originalViewPort) {
    // always restore the original viewport
    await pageObjectToUse.setViewportSize(originalViewPort)
  }
}

interface SnapshotWithViewPortProps {
  snapshotName: string
  viewPortName: keyof typeof viewPorts
  toMatchSnapshotOptions: ToMatchSnapshotOptions
  waitForThisToBeStable: ElementHandle | ElementHandle[]
  beforeScreenshot?: () => Promise<void>
  page?: Page
  frame?: Frame
  elementId?: string
  headless: boolean
  persistMousePosition?: boolean
  pageScreenshotOptions?: PageScreenshotOptions
  axeSkip: boolean | string[]
  scrollToYCoordinate?: number
  replaceSomePartsWithPlaceholders: boolean
}

async function snapshotWithViewPort({
  snapshotName,
  toMatchSnapshotOptions,
  viewPortName,
  waitForThisToBeStable,
  beforeScreenshot,
  frame,
  page,
  elementId,
  headless,
  persistMousePosition,
  pageScreenshotOptions,
  axeSkip,
  scrollToYCoordinate,
  replaceSomePartsWithPlaceholders,
}: SnapshotWithViewPortProps) {
  if (!persistMousePosition && page) {
    await page.mouse.move(0, 0)
  }

  let pageObjectToUse = page
  let thingBeingScreenshotted: Page | ElementHandle<Node> | undefined = page
  let thingBeingScreenshottedObject: Page | Frame | undefined = page
  if (frame) {
    pageObjectToUse = frame.page()
    thingBeingScreenshotted = await frame.frameElement()
    if (elementId) {
      thingBeingScreenshotted = (await thingBeingScreenshotted.$(elementId)) ?? undefined
    }
    thingBeingScreenshottedObject = frame
  }
  if (!pageObjectToUse || !thingBeingScreenshottedObject || !thingBeingScreenshotted) {
    throw new Error("Cannot get the the thing being screenshotted")
  }
  if (elementId) {
    const element = await pageObjectToUse.$(elementId)
    if (!element) {
      throw new Error("Could not find the element with id " + elementId)
    }
    thingBeingScreenshotted = element
  }

  // typing caret sometimes blinks and fails screenshot tests
  const style = await thingBeingScreenshottedObject.addStyleTag({
    content: `
  html, body {
    caret-color: rgba(0,0,0,0) !important;
  }
`,
  })
  if (replaceSomePartsWithPlaceholders) {
    await pageObjectToUse.dispatchEvent("body", HIDE_TEXT_IN_SYSTEM_TESTS_EVENT)
  }

  await pageObjectToUse.setViewportSize(viewPorts[viewPortName])
  await waitToBeStable({ waitForThisToBeStable })
  if (beforeScreenshot) {
    await pageObjectToUse.waitForTimeout(100)
    await beforeScreenshot()
    if (replaceSomePartsWithPlaceholders) {
      // Dispatch again in case the thing being hidden had not rendered yet when we previously dispatched this
      await pageObjectToUse.dispatchEvent("body", HIDE_TEXT_IN_SYSTEM_TESTS_EVENT)
    }

    await pageObjectToUse.waitForTimeout(100)
    await waitToBeStable({ waitForThisToBeStable })
  }

  // Last thing before taking the screenshot so that nothing will accidentally scroll the page after this.
  if (scrollToYCoordinate) {
    await (page || pageObjectToUse).evaluate(async (coord) => {
      window.scrollTo(0, coord)
    }, scrollToYCoordinate)
    // 100ms was not enough at the time of writing this
    await pageObjectToUse.waitForTimeout(200)
  }

  const screenshotName = `${snapshotName}-${viewPortName}.png`
  if (headless) {
    await takeScreenshotAndComparetoSnapshot(
      thingBeingScreenshotted,
      screenshotName,
      toMatchSnapshotOptions,
      pageObjectToUse,
      pageScreenshotOptions,
    )
  } else {
    console.warn("Not in headless mode, skipping screenshot")
  }

  if (!axeSkip || typeof axeSkip == "object") {
    // we do a accessibility check for every screenshot because the places we screenshot tend to also be important
    // for accessibility
    await accessibilityCheck(pageObjectToUse, screenshotName, axeSkip)
  }
  // show the typing caret again
  await style.evaluate((handle) => {
    if (handle instanceof Element) {
      handle.remove()
    } else {
      console.error("Could not remove the style that hides the typing caret.")
    }
  })
  if (replaceSomePartsWithPlaceholders) {
    await pageObjectToUse.dispatchEvent("body", SHOW_TEXT_IN_SYSTEM_TESTS_EVENT)
  }
}

interface WaitToBeVisibleProps {
  waitForThisToBeVisibleAndStable: string | ElementHandle | (string | ElementHandle)[]
  container: Page | Frame
  replaceSomePartsWithPlaceholders: boolean
}

export async function takeScreenshotAndComparetoSnapshot(
  thingBeingScreenshotted: ElementHandle<Node> | Page,
  screenshotName: string,
  toMatchSnapshotOptions: ToMatchSnapshotOptions,
  page: Page,
  pageScreenshotOptions?: PageScreenshotOptions,
): Promise<void> {
  try {
    const screenshot = await thingBeingScreenshotted.screenshot(pageScreenshotOptions)
    expect(screenshot).toMatchSnapshot(screenshotName, toMatchSnapshotOptions)
  } catch (e: unknown) {
    // sometimes snapshots have wild race conditions, lets try again in a moment
    console.warn(
      "Screenshot did not match snapshots retrying... Note that if this passes, the test is unstable",
    )
    await page.waitForTimeout(600)
    const screenshot = await thingBeingScreenshotted.screenshot(pageScreenshotOptions)
    expect(screenshot).toMatchSnapshot(screenshotName, toMatchSnapshotOptions)
  }
}

export async function waitToBeVisible({
  waitForThisToBeVisibleAndStable,
  container: page,
  replaceSomePartsWithPlaceholders,
}: WaitToBeVisibleProps): Promise<ElementHandle | ElementHandle[]> {
  if (replaceSomePartsWithPlaceholders) {
    await page.dispatchEvent("body", HIDE_TEXT_IN_SYSTEM_TESTS_EVENT)
  }
  let elementHandle: ElementHandle | ElementHandle[]
  if (typeof waitForThisToBeVisibleAndStable == "string") {
    elementHandle = await page.waitForSelector(waitForThisToBeVisibleAndStable)
  } else if (Array.isArray(waitForThisToBeVisibleAndStable)) {
    elementHandle = []
    for (const element of waitForThisToBeVisibleAndStable) {
      const recursiveRes = await waitToBeVisible({
        waitForThisToBeVisibleAndStable: element,
        container: page,
        replaceSomePartsWithPlaceholders,
      })
      if (Array.isArray(recursiveRes)) {
        elementHandle.push(...recursiveRes)
      } else {
        elementHandle.push(recursiveRes)
      }
    }
  } else {
    elementHandle = waitForThisToBeVisibleAndStable
  }
  return elementHandle
}

interface WaitForThisToBeStableProps {
  waitForThisToBeStable: ElementHandle | ElementHandle[]
}

async function waitToBeStable({
  waitForThisToBeStable,
}: WaitForThisToBeStableProps): Promise<void> {
  if (Array.isArray(waitForThisToBeStable)) {
    for (const element of waitForThisToBeStable) {
      await element.waitForElementState("stable")
    }
  } else if (waitForThisToBeStable) {
    await waitForThisToBeStable.waitForElementState("stable")
  }
}
