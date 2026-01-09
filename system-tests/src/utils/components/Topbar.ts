import { expect, Locator, Page } from "@playwright/test"

import { AriaMenu } from "./AriaMenu"

export class Topbar {
  readonly userMenuTrigger: Locator
  readonly quickActionsTrigger: Locator
  readonly searchButton: Locator

  readonly userMenu: AriaMenu
  readonly quickActions: AriaMenu
  readonly languageMenu: AriaMenu

  constructor(private readonly page: Page) {
    this.userMenuTrigger = page.locator("#topbar-user-menu")
    this.quickActionsTrigger = page.locator("#topbar-quick-actions")
    this.searchButton = page.locator("#search-for-pages-button")

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

  async expectDesktopVisible() {
    await expect(this.userMenuTrigger).toBeVisible()
  }
}
