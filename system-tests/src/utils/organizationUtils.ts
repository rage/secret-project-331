import { Page } from "@playwright/test"

/**
 * Clicks the "Select" button for the organization with the given heading.
 */
export async function selectOrganization(page: Page, orgName: string) {
  await page.getByRole("button", { name: `Visit organization ${orgName}` }).click()
}

export async function manageOrganization(page: Page, orgName: string) {
  await page.getByRole("button", { name: `Manage organization ${orgName}` }).click()
}
