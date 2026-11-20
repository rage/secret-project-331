import type { Page } from "@playwright/test"

/** Waits out RouteFocusManager's 3 s refocus window, then describes the focused element. */
export async function activeElementAfterRouteFocus(page: Page) {
  // oxlint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(3500)
  return page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    mainIsFocused: document.activeElement === document.querySelector("main"),
  }))
}
