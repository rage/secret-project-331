/* eslint-disable playwright/no-wait-for-timeout */
/* eslint-disable playwright/no-conditional-in-test */
import { expect, Locator, Page, test, TestInfo } from "@playwright/test"
import { stat } from "fs/promises"

import {
  HIDE_TEXT_IN_SYSTEM_TESTS_EVENT,
  SHOW_TEXT_IN_SYSTEM_TESTS_EVENT,
} from "../shared-module/utils/constants"

import accessibilityCheck from "./accessibilityCheck"
import { scrollLocatorOrLocatorsParentIframeToViewIfNeeded } from "./iframeLocators"
import {
  ensureImageHasBeenOptimized,
  imageSavedPageYCoordinate,
  savePageYCoordinateToImage,
} from "./imageMetadataTools"

// Same regex as Playwright uses to sanitize the filenames so that we can access those same files.
const PLAYWRIGHT_SCREENSHOT_NAME_SANITIZE_REGEX =
  // eslint-disable-next-line no-control-regex
  /[\x00-\x2C\x2E-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g

const viewPorts = {
  "desktop-regular": { width: 1920, height: 1080 },
  // Taller than a regular mobile screen, otherwise the screenshots would not have enough content to be useful
  "mobile-tall": { width: 411, height: 1080 },
}

/**
 * See https://playwright.dev/docs/api/class-locatorassertions#locator-assertions-to-have-screenshot-1.
 *
 * The second argument passed to expect(locator).toHaveScreenshot(name[, options])
 */
type ScreenshotOptions = Parameters<ReturnType<typeof expect<Locator>>["toHaveScreenshot"]>[0]
type PageScreenshotOptions = Parameters<ReturnType<typeof expect<Page>>["toHaveScreenshot"]>[0]

interface ExpectScreenshotsToMatchSnapshotsPropsCommon {
  headless: boolean | undefined
  snapshotName: string
  waitForTheseToBeVisibleAndStable?: Locator[]
  clearNotifications?: boolean
  beforeScreenshot?: () => Promise<void>
  axeSkip?: string[]
  skipMobile?: boolean
  /** If defined, the page will scroll to this y coordinate before taking the screenshot */
  scrollToYCoordinate?: number
  /** True by default. See the react component HideTextInSystemTests and the hook useShouldHideStuffFromSystemTestScreenshots on how to use this. */
  replaceSomePartsWithPlaceholders?: boolean
  testInfo: TestInfo
}

type ExpectScreenshotsToMatchSnapshotsPropsPage = ExpectScreenshotsToMatchSnapshotsPropsCommon & {
  screenshotTarget: Page
  screenshotOptions?: PageScreenshotOptions
}

type ExpectScreenshotsToMatchSnapshotsPropsLocator =
  ExpectScreenshotsToMatchSnapshotsPropsCommon & {
    screenshotTarget: Locator
    screenshotOptions?: ScreenshotOptions
  }

export type ExpectScreenshotsToMatchSnapshotsProps =
  | ExpectScreenshotsToMatchSnapshotsPropsPage
  | ExpectScreenshotsToMatchSnapshotsPropsLocator

export default async function expectScreenshotsToMatchSnapshots({
  headless = false,
  snapshotName,
  screenshotOptions,
  waitForTheseToBeVisibleAndStable,
  beforeScreenshot,
  clearNotifications = false,
  axeSkip = undefined,
  skipMobile = false,
  scrollToYCoordinate,
  replaceSomePartsWithPlaceholders = true,
  screenshotTarget,
  testInfo,
}: ExpectScreenshotsToMatchSnapshotsProps): Promise<void> {
  await test.step(`Expect screenshots to match snapshots "${snapshotName}"`, async () => {
    let page: Page
    if (isPage(screenshotTarget)) {
      page = screenshotTarget
    } else {
      page = screenshotTarget.page()
    }

    const originalViewPort = page.viewportSize()
    try {
      if (replaceSomePartsWithPlaceholders) {
        await page.dispatchEvent("body", HIDE_TEXT_IN_SYSTEM_TESTS_EVENT)
      }

      if (waitForTheseToBeVisibleAndStable) {
        await waitToBeVisible({
          waitForTheseToBeVisibleAndStable: waitForTheseToBeVisibleAndStable,
        })
      }

      if (clearNotifications) {
        await page.evaluate(() => {
          for (const notif of Array.from(document.querySelectorAll("#give-feedback-button"))) {
            notif.remove()
          }
          for (const notif of Array.from(document.querySelectorAll(".toast-notification"))) {
            notif.remove()
          }
        })
      }

      if (!skipMobile) {
        await snapshotWithViewPort({
          snapshotName,
          viewPortName: "mobile-tall",
          screenshotOptions,
          waitForTheseToBeVisibleAndStable,
          beforeScreenshot,
          headless,
          testInfo,
          axeSkip,
          scrollToYCoordinate,
          replaceSomePartsWithPlaceholders,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          screenshotTarget: screenshotTarget as any,
        })
      }

      await snapshotWithViewPort({
        snapshotName,
        viewPortName: "desktop-regular",
        screenshotOptions,
        beforeScreenshot,
        headless,
        testInfo,
        waitForTheseToBeVisibleAndStable,
        axeSkip,
        scrollToYCoordinate,
        replaceSomePartsWithPlaceholders,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        screenshotTarget: screenshotTarget as any,
      })
    } finally {
      if (originalViewPort) {
        // always restore the original viewport
        await page.setViewportSize(originalViewPort)
      }
    }
  })
}

type SnapshotWithViewPortProps = ExpectScreenshotsToMatchSnapshotsProps & SnapshotWithViewPortExtra

interface SnapshotWithViewPortExtra {
  viewPortName: keyof typeof viewPorts
}

async function snapshotWithViewPort({
  snapshotName,
  screenshotOptions,
  viewPortName,
  waitForTheseToBeVisibleAndStable,
  beforeScreenshot,
  headless,
  testInfo,
  axeSkip,
  scrollToYCoordinate,
  replaceSomePartsWithPlaceholders,
  screenshotTarget,
}: SnapshotWithViewPortProps) {
  let page: Page
  if (isPage(screenshotTarget)) {
    page = screenshotTarget
  } else {
    page = screenshotTarget.page()
  }

  await page.mouse.move(0, 0)

  if (replaceSomePartsWithPlaceholders) {
    await page.dispatchEvent("body", HIDE_TEXT_IN_SYSTEM_TESTS_EVENT)
  }

  await page.setViewportSize(viewPorts[viewPortName])
  if (waitForTheseToBeVisibleAndStable) {
    await waitToBeStable(waitForTheseToBeVisibleAndStable)
  }

  if (beforeScreenshot) {
    await page.waitForTimeout(100)
    await beforeScreenshot()
    if (replaceSomePartsWithPlaceholders) {
      // Dispatch again in case the thing being hidden had not rendered yet when we previously dispatched this
      await page.dispatchEvent("body", HIDE_TEXT_IN_SYSTEM_TESTS_EVENT)
    }

    await page.waitForTimeout(100)
    if (waitForTheseToBeVisibleAndStable) {
      await waitToBeStable(waitForTheseToBeVisibleAndStable)
    }
  }

  // Last thing before taking the screenshot so that nothing will accidentally scroll the page after this.
  if (scrollToYCoordinate) {
    await page.evaluate(async (coord) => {
      window.scrollTo(0, coord)
    }, scrollToYCoordinate)
    // 100ms was not enough at the time of writing this
    await page.waitForTimeout(200)
  }

  const screenshotName = `${snapshotName.replace(
    PLAYWRIGHT_SCREENSHOT_NAME_SANITIZE_REGEX,
    "-",
  )}-${viewPortName}.png`

  // Screenshots are slightly different in headless and headful modes. Therefore, we'll only do the screenshots in headless mode for consistency.
  if (headless) {
    // To make sure the scrolling we may have done previously has completed
    await page.waitForTimeout(100)
    await takeScreenshotAndComparetoSnapshot(
      screenshotTarget,
      screenshotName,
      screenshotOptions,
      testInfo,
      page,
    )
  } else {
    console.warn("Not in headless mode, skipping screenshot")
  }

  // we do a accessibility check for every screenshot because the places we screenshot tend to also be important
  // for accessibility
  await accessibilityCheck(page, screenshotName, axeSkip)

  if (replaceSomePartsWithPlaceholders) {
    await page.dispatchEvent("body", SHOW_TEXT_IN_SYSTEM_TESTS_EVENT)
  }
}

interface WaitToBeVisibleProps {
  waitForTheseToBeVisibleAndStable: Locator[]
}

export async function takeScreenshotAndComparetoSnapshot(
  screenshotTarget: Locator | Page,
  screenshotName: string,
  screenshotOptions: ScreenshotOptions | PageScreenshotOptions,
  testInfo: TestInfo,
  page: Page,
): Promise<void> {
  const pathToImage = testInfo.snapshotPath(screenshotName)
  let newScreenshot = false
  try {
    const _statRes = await stat(pathToImage)
  } catch (_e) {
    newScreenshot = true
  }

  try {
    if (isPage(screenshotTarget)) {
      await expect(screenshotTarget).toHaveScreenshot(screenshotName, screenshotOptions)
    } else {
      await expect(screenshotTarget).toHaveScreenshot(screenshotName, screenshotOptions)
    }
  } catch (e: unknown) {
    // sometimes snapshots have wild race conditions, lets try again in a moment
    console.warn(
      "Screenshot did not match snapshots retrying... Note that if this passes, the test is unstable",
    )
    const savedYCoordinate = await imageSavedPageYCoordinate(pathToImage)
    if (savedYCoordinate !== null) {
      console.log(
        `Found a saved y coordinate of ${savedYCoordinate}. Trying to scroll to it in case it helps to fix the test.`,
      )
      page.evaluate((savedYCoordinate) => {
        window.scrollTo(0, savedYCoordinate)
      }, savedYCoordinate)
    }
    await page.waitForTimeout(600)
    if (isPage(screenshotTarget)) {
      await expect(screenshotTarget).toHaveScreenshot(screenshotName, screenshotOptions)
    } else {
      await expect(screenshotTarget).toHaveScreenshot(screenshotName, screenshotOptions)
    }
  }
  if (testInfo.config.updateSnapshots === "all" || newScreenshot) {
    // When updating snapshots, optimize the new image so that it does not take extra space in version control.
    await ensureImageHasBeenOptimized(pathToImage)
    const savedYCoordinate = await imageSavedPageYCoordinate(pathToImage)
    if (savedYCoordinate === null) {
      await savePageYCoordinateToImage(pathToImage, page)
    }
  }
}

export async function waitToBeVisible({
  waitForTheseToBeVisibleAndStable,
}: WaitToBeVisibleProps): Promise<void> {
  for (const locator of waitForTheseToBeVisibleAndStable) {
    await scrollLocatorOrLocatorsParentIframeToViewIfNeeded(locator)
    await locator.waitFor({ state: "visible" })
  }
}

async function waitToBeStable(waitForThisToBeStable: Locator[]): Promise<void> {
  for (const locator of waitForThisToBeStable) {
    await scrollLocatorOrLocatorsParentIframeToViewIfNeeded(locator)
    const elementHandle = await locator.elementHandle()
    await elementHandle?.waitForElementState("stable")
  }
}

export function isPage(obj: unknown): obj is Page {
  const typedObj = obj as Page
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["setViewportSize"] === "function"
  )
}
