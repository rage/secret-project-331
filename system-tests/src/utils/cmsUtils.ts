import type { Page } from "@playwright/test"

import { waitForSuccessNotification } from "@/utils/notificationUtils"

/**
 * Saves the current CMS page and waits for the success notification
 * @param page Playwright page object
 */
export async function saveCMSPage(page: Page): Promise<void> {
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Save", exact: true }).click()
  })
}

/**
 * Expands the exercise's peer and self review configuration in the CMS block editor.
 *
 * The section is a plain `<details>` and keeps whatever state it was left in across saves, so
 * clicking the summary unconditionally collapses an already open section.
 */
export async function expandPeerAndSelfReviewConfig(page: Page): Promise<void> {
  const section = page.locator("details").filter({ hasText: "Peer and self review configuration" })
  if (await section.evaluate((details: HTMLDetailsElement) => details.open)) {
    return
  }
  await section.locator("summary").click()
}
