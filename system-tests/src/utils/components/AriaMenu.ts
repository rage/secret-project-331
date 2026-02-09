import { expect, Locator, Page } from "@playwright/test"

type AriaMenuOpts = {
  menuTestId: string
}

export class AriaMenu {
  constructor(
    private readonly page: Page,
    private readonly trigger: Locator,
    private readonly opts: AriaMenuOpts,
  ) {}

  /** Returns the locator for the underlying ARIA menu. */
  private menu(): Locator {
    return this.page.getByTestId(this.opts.menuTestId)
  }

  /** Closes known conflicting menus (like quick actions) before opening this menu. */
  private async closeConflictingMenus() {
    if (this.opts.menuTestId === "topbar-quick-actions-menu") {
      return
    }

    const quickActionsMenu = this.page.getByTestId("topbar-quick-actions-menu")
    if (await quickActionsMenu.isVisible()) {
      const quickActionsTrigger = this.page.getByTestId("topbar-quick-actions")
      await quickActionsTrigger.click()
      await expect(quickActionsMenu).toBeHidden()
    }
  }

  async open() {
    // Press esc in case another menu is open
    await this.page.keyboard.press("Escape")
    await this.closeConflictingMenus()
    await this.trigger.waitFor({ state: "visible" })
    await this.trigger.click()
    await expect(this.menu()).toBeVisible()
  }

  async clickItem(label: string) {
    await this.open()
    await this.menu().getByRole("menuitem", { name: label }).click()
    await expect(this.menu()).toBeHidden()
  }
}
