import { Page } from "@playwright/test"

/**
 * Clicks the "Select" button for the organization with the given heading.
 */
export async function selectOrganization(page: Page, orgName: string) {
  await page
    .getByLabel(orgName) // This selects the outermost <div aria-label="orgName">
    .getByRole("link", { name: "Select" }) // <a> with text "Select"
    .click()
}

export async function manageOrganization(page: Page, orgName: string) {
  await page
    .getByLabel(orgName)
    .getByRole("link")
    .filter({ hasText: ".gear_svg__cls-1{fill:none;" })
    .click()
}
