import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

/** Options for {@link Disclosure}. */
export interface DisclosureOptions {
  /** Tells this disclosure apart from others in the Playwright trace. */
  name?: string
}

const DEFAULT_NAME = "Disclosure"

/**
 * Drives a shared-module `Disclosure`.
 *
 * Construct with the trigger button — by `data-testid` where the component sets one, otherwise by
 * its accessible name, which is the title. The panel is the trigger's `aria-controls` target and a
 * sibling rather than a descendant, so it cannot be reached by scoping a lookup to the trigger.
 *
 * Expanding and collapsing read `aria-expanded` first, so calling either on a section already in
 * that state is a no-op. That matters in the CMS, where the editor keeps a section's state across
 * saves: an unconditional click closes what an earlier step opened.
 */
export class Disclosure {
  private readonly page: Page
  private readonly trigger: Locator
  private readonly name: string

  public constructor(page: Page, trigger: Locator, opts: DisclosureOptions = {}) {
    this.page = page
    this.trigger = trigger
    this.name = opts.name ?? DEFAULT_NAME
  }

  /** The trigger button, for assertions this driver does not cover. */
  public getTrigger(): Locator {
    return this.trigger
  }

  /** The panel the trigger controls. It stays in the DOM while collapsed, marked `hidden`. */
  public async getPanel(): Promise<Locator> {
    const panelId = await this.trigger.getAttribute("aria-controls")
    expect(panelId, `${this.name} trigger has no aria-controls`).not.toBeNull()
    return this.page.locator(`#${panelId}`)
  }

  /** Opens the section, leaving an already-open one alone. */
  public async expand(): Promise<void> {
    await test.step(`${this.name}: expand`, async () => {
      await this.setExpanded(true)
    })
  }

  /** Closes the section, leaving an already-closed one alone. */
  public async collapse(): Promise<void> {
    await test.step(`${this.name}: collapse`, async () => {
      await this.setExpanded(false)
    })
  }

  private async setExpanded(expanded: boolean): Promise<void> {
    await expect(this.trigger).toBeVisible()
    if ((await this.trigger.getAttribute("aria-expanded")) !== String(expanded)) {
      await this.trigger.click()
    }
    await expect(this.trigger).toHaveAttribute("aria-expanded", String(expanded))
  }
}
