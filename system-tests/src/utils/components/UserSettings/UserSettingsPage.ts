import type { Page } from "@playwright/test"
import { expect } from "@playwright/test"

import { AccountTab } from "./AccountTab"
import { PermissionsTab } from "./PermissionsTab"

export class UserSettingsPage {
  public readonly page: Page
  public readonly accountTab: AccountTab
  public readonly permissionsTab: PermissionsTab

  public constructor(page: Page) {
    this.page = page
    this.accountTab = new AccountTab(page)
    this.permissionsTab = new PermissionsTab(page)
  }

  public async waitForPage(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: "User settings" })).toBeVisible()
  }

  public async navigateToAccountTab(): Promise<void> {
    await this.page.getByRole("tab", { name: "Account" }).click()
    await this.accountTab.waitForTab()
  }

  public async navigateToPermissionsTab(): Promise<void> {
    await this.page.getByRole("tab", { name: "Permissions & Data" }).click()
    await this.permissionsTab.waitForTab()
  }
}
