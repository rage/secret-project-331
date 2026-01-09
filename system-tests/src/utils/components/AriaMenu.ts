import { expect, Locator, Page } from "@playwright/test"

type AriaMenuOpts = {
  menuTestId?: string
  menuAriaLabel?: string
}

export class AriaMenu {
  constructor(
    private readonly page: Page,
    private readonly trigger: Locator,
    private readonly opts: AriaMenuOpts = {},
  ) {}

  private menu(): Locator {
    if (this.opts.menuTestId) {
      return this.page.getByTestId(this.opts.menuTestId)
    }
    if (this.opts.menuAriaLabel) {
      return this.page.getByRole("menu", { name: this.opts.menuAriaLabel })
    }
    return this.page.getByRole("menu")
  }

  async open() {
    await this.trigger.click()
    await expect(this.menu()).toBeVisible()
  }

  async clickItem(label: string) {
    await this.open()
    await this.menu().getByRole("menuitem", { name: label }).click()
    await expect(this.menu()).toBeHidden()
  }
}
