import { expect, type Page } from "@playwright/test"

/**
 * Clicks a tab until it is selected. A click that lands before the page hydrates only focuses the
 * tab, so a plain click is lost on slow runs.
 */
export async function selectTab(page: Page, name: string): Promise<void> {
  await expect(async () => {
    await page.getByRole("tab", { name, exact: true }).click()
    await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 1000 },
    )
  }).toPass({ timeout: 15000 })
}
