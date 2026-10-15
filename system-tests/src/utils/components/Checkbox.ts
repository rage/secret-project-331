import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

/** Options for {@link Checkbox}. */
export interface CheckboxOptions {
  /** Tells this checkbox apart from others in the Playwright trace. */
  name?: string
}

const DEFAULT_NAME = "Checkbox"

/**
 * Drives a shared-module `Checkbox`.
 *
 * The native input is visually hidden under its label, so clicking the label text is intercepted
 * by the input; construct with the input itself, located by role and exact label.
 *
 * Sibling driver for the toggle variant is `Switch`.
 */
export class Checkbox {
  private readonly input: Locator
  private readonly name: string

  /** The checkbox labelled exactly `label` within `scope`. */
  public static labelled(page: Page, label: string, scope: Page | Locator = page): Checkbox {
    return new Checkbox(scope.getByRole("checkbox", { name: label, exact: true }), { name: label })
  }

  public constructor(input: Locator, opts: CheckboxOptions = {}) {
    this.input = input
    this.name = opts.name ?? DEFAULT_NAME
  }

  /** The input, for assertions this driver does not cover. */
  public getInput(): Locator {
    return this.input
  }

  /**
   * Brings the checkbox to `checked`, leaving one already in that state alone.
   *
   * Retries the click until the state settles: in the CMS the value round-trips through block
   * attributes, and a click can be reverted once before the new value sticks.
   */
  public async setChecked(checked: boolean): Promise<void> {
    await test.step(`${this.name}: ${checked ? "check" : "uncheck"}`, async () => {
      await expect(async () => {
        if ((await this.input.isChecked()) !== checked) {
          await this.input.click()
        }
        await expect(this.input).toBeChecked({ checked, timeout: 2000 })
      }).toPass({ timeout: 15000 })
    })
  }

  /** Asserts the checkbox is checked, or unchecked when `checked` is false. */
  public async expectChecked(checked = true): Promise<void> {
    await test.step(`${this.name}: expect ${checked ? "checked" : "unchecked"}`, async () => {
      await expect(this.input).toBeChecked({ checked })
    })
  }
}
