import { Page } from "@playwright/test"

/**
 * Clicks the "Select" button for the organization with the given heading.
 */
export async function selectOrganization(page: Page, orgName: string) {
  await page
    .getByRole("heading", { name: orgName })
    .locator("..")
    .locator("..")
    .getByRole("button", { name: "Select" })
    .click()
}
