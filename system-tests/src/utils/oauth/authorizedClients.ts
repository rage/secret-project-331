import { Page } from "@playwright/test"

import { APP_DISPLAY_NAME, BASE, TEST_CLIENT_ID } from "./constants"

import { UserSettingsPage } from "@/utils/components/UserSettings/UserSettingsPage"

/** Reset this user's authorization for our test client (clean slate for OAuth tests) */
export async function resetClientAuthorization(page: Page) {
  await page.goto(`${BASE}/user-settings/account`)
  const userSettings = new UserSettingsPage(page)
  await userSettings.waitForPage()
  await userSettings.navigateToPermissionsTab()
  await userSettings.permissionsTab.scrollToAuthorizedApplications()

  const apps = await userSettings.permissionsTab.getAuthorizedApplications()

  for (const app of apps) {
    if (app.name === APP_DISPLAY_NAME || app.name === TEST_CLIENT_ID) {
      try {
        await userSettings.permissionsTab.revokeAuthorizedApplication(app.name)
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
