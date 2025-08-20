import { Page } from "@playwright/test"

/**
 * Clicks the "Select" button for the organization with the given heading.
 */
export async function selectOrganization(page: Page, orgName: string) {
  await page.getByLabel(orgName).getByRole("link", { name: "Select" }).click()
}

/**
 * Clicks the "Manage" button for the organization with the given heading.
 */
export async function manageOrganization(page: Page, orgName: string) {
  await page.getByRole("link", { name: `Manage organization ${orgName}` }).click()
}
