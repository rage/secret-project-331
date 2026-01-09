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

  private menu(): Locator {
    return this.page.getByTestId(this.opts.menuTestId)
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
