import { ElementHandle, expect, Frame, Page } from "@playwright/test"

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
}

export default async function expectScreenshotsToMatchSnapshots({
  headless,
  snapshotName,
  toMatchSnapshotOptions = { threshold: 0.3 },
  waitForThisToBeVisibleAndStable,
  beforeScreenshot,
  frame,
  page,
}: ExpectScreenshotsToMatchSnapshotsProps): Promise<void> {
  if (!headless && !process.env.PWDEBUG) {
    console.warn("Not in headless mode, skipping screenshot model solutions in exercises")
    return
  }

  if (page) {
    const originalViewPort = page.viewportSize()
    const elementHandle = await waitToBeVisible({ waitForThisToBeVisibleAndStable, page })

    await snapshotWithViewPort({
      snapshotName,
      viewPortName: "mobile",
      toMatchSnapshotOptions,
      waitForThisToBeStable: elementHandle,
      beforeScreenshot,
      page,
    })

    await snapshotWithViewPort({
      snapshotName,
      viewPortName: "small-desktop",
      toMatchSnapshotOptions,
      waitForThisToBeStable: elementHandle,
      beforeScreenshot,
      page,
    })

    await page.setViewportSize(originalViewPort)
  } else if (frame) {
    const originalViewPort = frame.page().viewportSize()
    const elementHandle = await frame.frameElement()

    await snapshotWithViewPort({
      snapshotName,
      viewPortName: "mobile",
      toMatchSnapshotOptions,
      waitForThisToBeStable: elementHandle,
      beforeScreenshot,
      frame,
    })

    await snapshotWithViewPort({
      snapshotName,
      viewPortName: "small-desktop",
      toMatchSnapshotOptions,
      waitForThisToBeStable: elementHandle,
      beforeScreenshot,
      frame,
    })
    await frame.page().setViewportSize(originalViewPort)
  } else {
    console.warn("no page or frame provided")
    return
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
}

async function snapshotWithViewPort({
  snapshotName,
  toMatchSnapshotOptions,
  viewPortName,
  waitForThisToBeStable,
  beforeScreenshot,
  frame,
  page,
}: SnapshotWithViewPortProps) {
  // typing caret sometimes blinks and fails screenshot tests
  if (page) {
    const style = await page.addStyleTag({
      content: `
    html, body {
      caret-color: rgba(0,0,0,0) !important;
    }
  `,
    })
    await page.setViewportSize(viewPorts[viewPortName])
    await waitToBeStable({ waitForThisToBeStable })
    if (beforeScreenshot) {
      await page.waitForTimeout(100)
      await beforeScreenshot()
      await page.waitForTimeout(100)
      await waitToBeStable({ waitForThisToBeStable })
    }

    const screenshot = await page.screenshot()
    const screenshotName = `${snapshotName}-${viewPortName}.png`
    expect(screenshot).toMatchSnapshot(screenshotName, toMatchSnapshotOptions)
    // we do a accessibility check for every screenshot because the places we screenshot tend to also be important
    // for accessibility
    await accessibilityCheck(page, screenshotName)
    // show the typing caret again
    await style.evaluate((handle) => {
      if (handle instanceof Element) {
        handle.remove()
      } else {
        console.error("Could not remove the style that hides the typing caret.")
      }
    })
  } else if (frame) {
    const style = await frame.addStyleTag({
      content: `
    html, body {
      caret-color: rgba(0,0,0,0) !important;
    }
  `,
    })
    await frame.page().setViewportSize(viewPorts[viewPortName])
    await waitToBeStable({ waitForThisToBeStable })
    if (beforeScreenshot) {
      await frame.waitForTimeout(100)
      await beforeScreenshot()
      await frame.waitForTimeout(100)
      await waitToBeStable({ waitForThisToBeStable })
    }

    const screenshot = await (await frame.frameElement()).screenshot()
    const screenshotName = `${snapshotName}-${viewPortName}.png`
    expect(screenshot).toMatchSnapshot(screenshotName, toMatchSnapshotOptions)
    // show the typing caret again
    await style.evaluate((handle) => {
      if (handle instanceof Element) {
        handle.remove()
      } else {
        console.error("Could not remove the style that hides the typing caret.")
      }
    })
  }
}

interface WaitToBeVisibleProps {
  waitForThisToBeVisibleAndStable: string | ElementHandle | (string | ElementHandle)[]
  page: Page
}

export async function waitToBeVisible({
  waitForThisToBeVisibleAndStable,
  page,
}: WaitToBeVisibleProps): Promise<ElementHandle | ElementHandle[]> {
  let elementHandle: ElementHandle | ElementHandle[] = null
  if (typeof waitForThisToBeVisibleAndStable == "string") {
    elementHandle = await page.waitForSelector(waitForThisToBeVisibleAndStable)
  } else if (Array.isArray(waitForThisToBeVisibleAndStable)) {
    for (const element of waitForThisToBeVisibleAndStable) {
      // for some reason eslint mistakes recursion as an unsused variable
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      elementHandle = await waitToBeVisible({ waitForThisToBeVisibleAndStable: element, page })
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
