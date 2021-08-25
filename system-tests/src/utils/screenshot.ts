import { ElementHandle, expect, Page } from "@playwright/test"

import accessibilityCheck from "./accessibilityCheck"

const viewPorts = {
  "small-desktop": { width: 1280, height: 720 },
  mobile: { width: 411, height: 731 },
}

interface ToMatchSnapshotOptions {
  threshold: number
}

export default async function expectScreenshotsToMatchSnapshots(
  page: Page,
  headless: boolean,
  snapshotName: string,
  waitForThisToBeVisibleAndStable: string | ElementHandle | (string | ElementHandle)[],
  toMatchSnapshotOptions: ToMatchSnapshotOptions = { threshold: 0.3 },
): Promise<void> {
  if (!headless && !process.env.PWDEBUG) {
    console.warn("Not in headless mode, skipping screenshot model solutions in exercises")
    return
  }

  const originalViewPort = page.viewportSize()

  const elementHandle = await waitToBeVisible(waitForThisToBeVisibleAndStable, page)

  await snapshotWithViewPort(page, snapshotName, "mobile", toMatchSnapshotOptions, elementHandle)
  await snapshotWithViewPort(
    page,
    snapshotName,
    "small-desktop",
    toMatchSnapshotOptions,
    elementHandle,
  )

  await page.setViewportSize(originalViewPort)
}

async function snapshotWithViewPort(
  page: Page,
  snapshotName: string,
  viewPortName: keyof typeof viewPorts,
  toMatchSnapshotOptions: ToMatchSnapshotOptions,
  waitForThisToBeStable: ElementHandle | ElementHandle[],
) {
  await page.setViewportSize(viewPorts[viewPortName])
  if (Array.isArray(waitForThisToBeStable)) {
    for (const element of waitForThisToBeStable) {
      await element.waitForElementState("stable")
    }
  } else if (waitForThisToBeStable) {
    await waitForThisToBeStable.waitForElementState("stable")
  }
  const screenshot = await page.screenshot()
  const screenshotName = `${snapshotName}-${viewPortName}.png`
  expect(screenshot).toMatchSnapshot(screenshotName, toMatchSnapshotOptions)
  // we do a accessibility check for every screenshot because the places we screenshot tend to also be important
  // for accessibility
  await accessibilityCheck(page, screenshotName)
}

async function waitToBeVisible(
  waitForThisToBeVisibleAndStable: string | ElementHandle | (string | ElementHandle)[],
  page: Page,
): Promise<ElementHandle | ElementHandle[]> {
  let elementHandle: ElementHandle | ElementHandle[] = null
  if (typeof waitForThisToBeVisibleAndStable == "string") {
    elementHandle = await page.waitForSelector(waitForThisToBeVisibleAndStable)
  } else if (Array.isArray(waitForThisToBeVisibleAndStable)) {
    for (const element of waitForThisToBeVisibleAndStable) {
      // for some reason eslint mistakes recursion as an unsused variable
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      elementHandle = await waitToBeVisible(element, page)
    }
  } else {
    elementHandle = waitForThisToBeVisibleAndStable
  }
  return elementHandle
}
