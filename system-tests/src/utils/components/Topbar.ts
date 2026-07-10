import type { Locator, Page } from "@playwright/test"
import { expect } from "@playwright/test"

import { AriaMenu } from "./AriaMenu"

export class Topbar {
  public readonly userMenuTrigger: Locator
  public readonly quickActionsTrigger: Locator
  public readonly searchButton: Locator
  public readonly loginLink: Locator

  public readonly userMenu: AriaMenu
  public readonly quickActions: AriaMenu
  public readonly languageMenu: AriaMenu

  public constructor(private readonly page: Page) {
    this.userMenuTrigger = page.locator("#topbar-user-menu")
    this.quickActionsTrigger = page.getByTestId("topbar-quick-actions")
    this.searchButton = page.locator("#search-for-pages-button")
    this.loginLink = page.getByLabel("Top bar").getByRole("link", { name: "Log in" })

    this.userMenu = new AriaMenu(page, this.userMenuTrigger, {
      menuTestId: "topbar-user-menu-popover",
    })

    this.languageMenu = new AriaMenu(page, page.locator("#topbar-language-menu"), {
      menuTestId: "topbar-language-menu-popover",
    })

    this.quickActions = new AriaMenu(page, this.quickActionsTrigger, {
      menuTestId: "topbar-quick-actions-menu",
    })
  }

  public async expectDesktopVisible() {
    await expect(this.userMenuTrigger).toBeVisible()
  }

  /** Clicks whichever login control appears, preferring quick actions when visible. */
  public async clickLogin() {
    if (await this.quickActionsTrigger.isVisible()) {
      await this.quickActions.clickItem("Log in")
      return
    }

    await this.loginLink.click()
  }

  /** Logs out via the user menu. */
  public async logout() {
    await this.userMenu.clickItem("Log out")
    await this.loginLink.waitFor()
  }
}
