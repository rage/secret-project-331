import { Locator } from "@playwright/test"

//** Waits for animation to end and location to become stable */
export async function waitForAnimationsToEnd(locator: Locator) {
  const handle = await locator.elementHandle()
  await handle?.waitForElementState("stable")
  handle?.dispose()
}
