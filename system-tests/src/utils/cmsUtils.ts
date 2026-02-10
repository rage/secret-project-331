import { Page } from "@playwright/test"

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
