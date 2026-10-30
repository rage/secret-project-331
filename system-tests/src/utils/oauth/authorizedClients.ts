import type { Page } from "@playwright/test"

import type { PermissionsTab } from "@/utils/components/UserSettings/PermissionsTab"
import { UserSettingsPage } from "@/utils/components/UserSettings/UserSettingsPage"

import { APP_DISPLAY_NAME, BASE, TEST_CLIENT_ID } from "./constants"

/** Opens the signed-in user's permissions settings at the authorized applications. */
export async function openAuthorizedApplications(page: Page): Promise<PermissionsTab> {
  await page.goto(`${BASE}/user-settings/account`)
  const userSettings = new UserSettingsPage(page)
  await userSettings.waitForPage()
  await userSettings.navigateToPermissionsTab()
  await userSettings.permissionsTab.scrollToAuthorizedApplications()
  return userSettings.permissionsTab
}

/** Reset this user's authorization for our test client (clean slate for OAuth tests) */
export async function resetClientAuthorization(page: Page) {
  const permissions = await openAuthorizedApplications(page)
  const apps = await permissions.getAuthorizedApplications()

  for (const app of apps) {
    if (app.name === APP_DISPLAY_NAME || app.name === TEST_CLIENT_ID) {
      try {
        await permissions.revokeAuthorizedApplication(app.name)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (errorMessage.includes("not found")) {
          continue
        }
        throw error
      }
    }
  }
}
