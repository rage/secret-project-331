import { Page } from "@playwright/test"

/**
 * Saves the current CMS page and waits for the success notification
 * @param page Playwright page object
 */
export async function saveCMSPage(page: Page): Promise<void> {
  // Make sure the previous success notification is hidden
  await page.getByText("Operation successful!").waitFor({ state: "hidden" })
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await page.getByText("Operation successful!").waitFor()
}
