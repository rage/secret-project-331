import { expect, Page } from "@playwright/test"

import { APP_DISPLAY_NAME, BASE, TEST_CLIENT_ID } from "./constants"

/** Revoke a single client row by visible name */
export async function revokeClientRow(page: Page, displayName: string) {
  const row = page
    .locator("div", { has: page.locator("strong", { hasText: displayName }) })
    .filter({ has: page.getByRole("button") })
    .first()

  if ((await row.count()) === 0) {
    return false
  }
  const revokeBtn = row.getByRole("button", { name: "REVOKE" })
  await revokeBtn.click()
  await expect(row).toHaveCount(0)
  return true
}

export async function openAuthorizedApps(page: Page) {
  await page.goto(`${BASE}/user-settings`)
  const authorizedHeading = page.getByRole("heading", { name: /Authorized applications/i })
  await authorizedHeading.scrollIntoViewIfNeeded()
  await expect(authorizedHeading).toBeVisible()
}

/** Reset this user's authorization for our test client (clean slate for Suite 2) */
export async function resetClientAuthorization(page: Page) {
  await openAuthorizedApps(page)
  // Try revoke by display name and client_id (in case the UI shows either)
  await revokeClientRow(page, APP_DISPLAY_NAME)
  await revokeClientRow(page, TEST_CLIENT_ID)
}
