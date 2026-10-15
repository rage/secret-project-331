import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { overlayControlledBy } from "./overlays"

/** Options for {@link Menu}. */
export interface MenuOptions {
  /** Tells this menu apart from others in the Playwright trace. */
  name?: string
}

const DEFAULT_NAME = "Menu"

/**
 * Drives a shared-module `Menu`: a trigger button that opens a list of actions.
 *
 * The menu is portaled to `document.body`, so it is reached through the trigger's `aria-controls`
 * rather than by scoping to the trigger. For the topbar menus, which predate `Menu`, use `AriaMenu`.
 */
export class Menu {
  private readonly page: Page
  private readonly trigger: Locator
  private readonly name: string

  public constructor(page: Page, trigger: Locator, opts: MenuOptions = {}) {
    this.page = page
    this.trigger = trigger
    this.name = opts.name ?? DEFAULT_NAME
  }

  /** The trigger button, for assertions this driver does not cover. */
  public getTrigger(): Locator {
    return this.trigger
  }

  /** Opens the menu and runs the item labelled exactly `label`. */
  public async chooseItem(label: string): Promise<void> {
    await test.step(`${this.name}: choose "${label}"`, async () => {
      const menu = await this.open()
      await menu.getByRole("menuitem", { name: label, exact: true }).click()
      await expect(this.trigger).toHaveAttribute("aria-expanded", "false")
    })
  }

  /** Asserts the menu offers exactly `labels`, in order, and closes it again. */
  public async expectItemLabels(labels: string[]): Promise<void> {
    await test.step(`${this.name}: expect items ${labels.join(", ")}`, async () => {
      const menu = await this.open()
      await expect(menu.getByRole("menuitem")).toHaveText(labels)
      await this.page.keyboard.press("Escape")
      await expect(this.trigger).toHaveAttribute("aria-expanded", "false")
    })
  }

  private async open(): Promise<Locator> {
    // Not `expect().toBeVisible()`: its 5s timeout is too short for a page that is still loading.
    await this.trigger.waitFor()
    if ((await this.trigger.getAttribute("aria-expanded")) !== "true") {
      await this.trigger.click()
    }
    await expect(this.trigger).toHaveAttribute("aria-expanded", "true")
    return overlayControlledBy(this.page, this.trigger)
  }
}
