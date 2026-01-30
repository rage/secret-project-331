import { expect, Locator, Page } from "@playwright/test"

import { AccountTab } from "./AccountTab"
import { PermissionsTab } from "./PermissionsTab"

export class UserSettingsPage {
  readonly page: Page
  readonly accountTab: AccountTab
  readonly permissionsTab: PermissionsTab

  constructor(page: Page) {
    this.page = page
    this.accountTab = new AccountTab(page)
    this.permissionsTab = new PermissionsTab(page)
  }

  async waitForPage(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: "User settings" })).toBeVisible()
  }

  async navigateToAccountTab(): Promise<void> {
    await this.page.getByRole("tab", { name: "Account" }).click()
    await this.accountTab.waitForTab()
  }

  async navigateToPermissionsTab(): Promise<void> {
    await this.page.getByRole("tab", { name: "Permissions & Data" }).click()
    await this.permissionsTab.waitForTab()
  }
}
