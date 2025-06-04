import { Page } from "@playwright/test"

/**
 * Clicks the "Select" button for the organization with the given heading.
 */
export async function selectOrganization(page: Page, orgName: string) {
  await page.getByLabel(orgName).getByRole("button", { name: "Select" }).click()
}
