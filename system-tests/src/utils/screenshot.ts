import { ElementHandle, expect, Frame, Page, PageScreenshotOptions } from "@playwright/test"

import accessibilityCheck from "./accessibilityCheck"

const viewPorts = {
  "small-desktop": { width: 1280, height: 720 },
  mobile: { width: 411, height: 731 },
}

interface ToMatchSnapshotOptions {
  threshold: number
}

interface ExpectScreenshotsToMatchSnapshotsProps {
  headless: boolean
  snapshotName: string
  waitForThisToBeVisibleAndStable?: string | ElementHandle | (string | ElementHandle)[]
  toMatchSnapshotOptions?: ToMatchSnapshotOptions
  beforeScreenshot?: () => Promise<void>
  page?: Page
  frame?: Frame
  pageScreenshotOptions?: PageScreenshotOptions
  axeSkip: boolean
}

export default async function expectScreenshotsToMatchSnapshots({
  headless,
  snapshotName,
  toMatchSnapshotOptions = { threshold: 0.3 },
  waitForThisToBeVisibleAndStable,
  beforeScreenshot,
  frame,
  page,
  pageScreenshotOptions,
  // keep false for new screenshots
  axeSkip = false,
}: ExpectScreenshotsToMatchSnapshotsProps): Promise<void> {
  if (!page && !frame) {
    throw new Error("No page or frame provided to expectScreenshotsToMatchSnapshots")
  }
  let pageObjectToUse = page
  let visibilityWaitContainer: Page | Frame = page
  let originalViewPort = page?.viewportSize()
  if (frame) {
    pageObjectToUse = frame.page()
    originalViewPort = pageObjectToUse.viewportSize()
    visibilityWaitContainer = frame
  }

  // if frame is passed, then we take a screenshot of the frame istead of the page
  if (frame) {
    const frameElement = await frame.frameElement()
    // The frame is not always visible, and waitForThisToBeVisibleAndStable won't work if the frame is not visible
    await frameElement.scrollIntoViewIfNeeded()
  }

  const elementHandle = await waitToBeVisible({
    waitForThisToBeVisibleAndStable,
    container: visibilityWaitContainer,
  })

  await snapshotWithViewPort({
    snapshotName,
    viewPortName: "mobile",
    toMatchSnapshotOptions,
    waitForThisToBeStable: elementHandle,
    beforeScreenshot,
    page,
    frame,
    headless,
    pageScreenshotOptions,
    axeSkip,
  })

  await snapshotWithViewPort({
    snapshotName,
    viewPortName: "small-desktop",
    toMatchSnapshotOptions,
    waitForThisToBeStable: elementHandle,
    beforeScreenshot,
    page,
    frame,
    headless,
    pageScreenshotOptions,
    axeSkip,
  })

  // always restore the original viewport
  await pageObjectToUse.setViewportSize(originalViewPort)
}

interface SnapshotWithViewPortProps {
  snapshotName: string
  viewPortName: keyof typeof viewPorts
  toMatchSnapshotOptions: ToMatchSnapshotOptions
  waitForThisToBeStable: ElementHandle | ElementHandle[]
  beforeScreenshot?: () => Promise<void>
  page?: Page
  frame?: Frame
  headless: boolean
  persistMousePosition?: boolean
  pageScreenshotOptions?: PageScreenshotOptions
  axeSkip: boolean
}

async function snapshotWithViewPort({
  snapshotName,
  toMatchSnapshotOptions,
  viewPortName,
  waitForThisToBeStable,
  beforeScreenshot,
  frame,
  page,
  headless,
  persistMousePosition,
  pageScreenshotOptions,
  axeSkip,
}: SnapshotWithViewPortProps) {
  if (!persistMousePosition && page) {
    await page.mouse.move(0, 0)
  }

  let pageObjectToUse = page
  let thingBeingScreenshotted: Page | ElementHandle<Node> = page
  let thingBeingScreenshottedObject: Page | Frame = page
  if (frame) {
    pageObjectToUse = frame.page()
    thingBeingScreenshotted = await frame.frameElement()
    thingBeingScreenshottedObject = frame
  }
  // typing caret sometimes blinks and fails screenshot tests
  const style = await thingBeingScreenshottedObject.addStyleTag({
    content: `
  html, body {
    caret-color: rgba(0,0,0,0) !important;
  }
`,
  })
  await pageObjectToUse.setViewportSize(viewPorts[viewPortName])
  await waitToBeStable({ waitForThisToBeStable })
  if (beforeScreenshot) {
    await pageObjectToUse.waitForTimeout(100)
    await beforeScreenshot()
    await pageObjectToUse.waitForTimeout(100)
    await waitToBeStable({ waitForThisToBeStable })
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

  if (!axeSkip) {
    // we do a accessibility check for every screenshot because the places we screenshot tend to also be important
    // for accessibility
    await accessibilityCheck(pageObjectToUse, screenshotName)
  }
  // show the typing caret again
  await style.evaluate((handle) => {
    if (handle instanceof Element) {
      handle.remove()
    } else {
      console.error("Could not remove the style that hides the typing caret.")
    }
  })
}

interface WaitToBeVisibleProps {
  waitForThisToBeVisibleAndStable: string | ElementHandle | (string | ElementHandle)[]
  container: Page | Frame
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
    await page.waitForTimeout(100)
    const screenshot = await thingBeingScreenshotted.screenshot(pageScreenshotOptions)
    expect(screenshot).toMatchSnapshot(screenshotName, toMatchSnapshotOptions)
  }
}

export async function waitToBeVisible({
  waitForThisToBeVisibleAndStable,
  container: page,
}: WaitToBeVisibleProps): Promise<ElementHandle | ElementHandle[]> {
  let elementHandle: ElementHandle | ElementHandle[] = null
  if (typeof waitForThisToBeVisibleAndStable == "string") {
    elementHandle = await page.waitForSelector(waitForThisToBeVisibleAndStable)
  } else if (Array.isArray(waitForThisToBeVisibleAndStable)) {
    for (const element of waitForThisToBeVisibleAndStable) {
      // for some reason eslint mistakes recursion as an unsused variable
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      elementHandle = await waitToBeVisible({
        waitForThisToBeVisibleAndStable: element,
        container: page,
      })
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
