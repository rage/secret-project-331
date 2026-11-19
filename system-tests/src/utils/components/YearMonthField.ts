import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { overlayControlledBy } from "./overlays"
import { YearMonthPicker } from "./YearMonthPicker"

/**
 * Driver for the shared-module `YearMonthField`, whose committed value is a `yyyy-MM` string.
 *
 * Unlike the segmented fields, this one's `data-testid` lands on the field shell's control slot, so
 * both the trigger and the hidden input sit inside it.
 */
export class YearMonthField {
  private readonly page: Page
  private readonly testId: string

  public constructor(page: Page, testId: string) {
    this.page = page
    this.testId = testId
  }

  /** The control slot, which contains the trigger and the hidden input. */
  public getControl(): Locator {
    return this.page.getByTestId(this.testId)
  }

  public getTrigger(): Locator {
    return this.getControl().getByTestId(`${this.testId}-trigger`)
  }

  /** The hidden input holding the serialized `yyyy-MM` value. */
  public getValueInput(): Locator {
    return this.getControl().getByTestId(`${this.testId}-value`)
  }

  public async expectValue(expected: string): Promise<void> {
    await test.step(`Expect ${this.testId} to hold "${expected}"`, async () => {
      await expect(this.getValueInput()).toHaveValue(expected)
    })
  }

  /** Opens the month picker and returns a driver for it. */
  public async open(): Promise<YearMonthPicker> {
    const trigger = this.getTrigger()
    return await test.step(`Open the month picker of ${this.testId}`, async () => {
      await trigger.click()
      // `aria-controls` only names the popover while it is open, so resolve it after the click.
      await expect(trigger).toHaveAttribute("aria-expanded", "true")
      const overlay = await overlayControlledBy(this.page, trigger)
      await expect(overlay).toBeVisible()
      return new YearMonthPicker(overlay)
    })
  }

  public async close(): Promise<void> {
    await test.step(`Close the month picker of ${this.testId}`, async () => {
      await this.page.keyboard.press("Escape")
      await expect(this.getTrigger()).toHaveAttribute("aria-expanded", "false")
    })
  }
}
