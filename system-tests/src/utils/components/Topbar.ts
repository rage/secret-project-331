import { expect, Locator, Page } from "@playwright/test"

import { AriaMenu } from "./AriaMenu"

export class Topbar {
  readonly userMenuTrigger: Locator
  readonly quickActionsTrigger: Locator
  readonly searchButton: Locator
  readonly loginLink: Locator

  readonly userMenu: AriaMenu
  readonly quickActions: AriaMenu
  readonly languageMenu: AriaMenu

  constructor(private readonly page: Page) {
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

  async expectDesktopVisible() {
    await expect(this.userMenuTrigger).toBeVisible()
  }

  /** Clicks whichever login control appears (quick actions menu or login link); first successful click wins. */
  async clickLogin() {
    await Promise.any([this.quickActions.clickItem("Log in"), this.loginLink.click()])
  }
}
