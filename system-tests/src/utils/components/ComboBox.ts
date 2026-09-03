import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { overlayControlledBy } from "./overlays"

/** Options for {@link ComboBox}. */
export interface ComboBoxOptions {
  /** Tells this combo box apart from others in the Playwright trace. */
  name?: string
}

const DEFAULT_NAME = "ComboBox"

/**
 * Drives a shared-module `ComboBox`.
 *
 * Construct with the text input, which is what carries `data-testid` and what every method acts
 * on; the chevron button is excluded from the tab order and is never needed here. The suggestion
 * list is portaled to `document.body`, so it is not a descendant of the input.
 *
 * The sibling driver for the fixed-option variant is `Select`.
 */
export class ComboBox {
  private readonly page: Page
  private readonly input: Locator
  private readonly name: string

  public constructor(page: Page, input: Locator, opts: ComboBoxOptions = {}) {
    this.page = page
    this.input = input
    this.name = opts.name ?? DEFAULT_NAME
  }

  /** The text input, for assertions this driver does not cover. */
  public getInput(): Locator {
    return this.input
  }

  /** Opens the suggestion list and leaves it open. */
  public async open(): Promise<void> {
    await test.step(`${this.name}: open`, async () => {
      await this.openIfClosed()
    })
  }

  /** Closes the suggestion list, reverting any text typed since the last selection. */
  public async close(): Promise<void> {
    await test.step(`${this.name}: close`, async () => {
      await this.input.press("Escape")
      await expect(this.input).toHaveAttribute("aria-expanded", "false")
    })
  }

  /**
   * Selects the suggestion rendering as `label`, opening the list first.
   *
   * `label` is matched whole, after whitespace trimming, and is also asserted to be the committed
   * input text, which holds unless the combo box renders items as something other than their
   * `getItemTextValue`. Narrow a long list with {@link filterOptions} first.
   */
  public async chooseOption(label: string): Promise<void> {
    await test.step(`${this.name}: choose "${label}"`, async () => {
      await this.openIfClosed()
      const listBox = await this.listBox()
      await listBox.getByRole("option", { name: label, exact: true }).click()
      await this.expectClosedShowing(label)
    })
  }

  /**
   * Selects the suggestion whose `getItemKey` is `key`.
   *
   * For ids a spec holds but a user never sees; prefer {@link chooseOption} wherever the visible
   * label is known.
   */
  public async chooseOptionByKey(key: string): Promise<void> {
    await test.step(`${this.name}: choose key "${key}"`, async () => {
      await this.openIfClosed()
      const listBox = await this.listBox()
      const option = listBox.locator(`[role="option"][data-key=${JSON.stringify(key)}]`)
      const label = ((await option.textContent()) ?? "").trim()
      await option.click()
      await this.expectClosedShowing(label)
    })
  }

  /**
   * Replaces the input text with `query`, narrowing the suggestions to the matches.
   *
   * The text stays uncommitted: anything that blurs the input before an option is chosen reverts
   * it to the current selection.
   */
  public async filterOptions(query: string): Promise<void> {
    await test.step(`${this.name}: filter by "${query}"`, async () => {
      await this.openIfClosed()
      await this.input.press("ControlOrMeta+a")
      // Typed a key at a time rather than filled: a non-editable combo box cancels keystrokes in
      // onBeforeInput, and a programmatic fill would slip past that and desynchronise the field.
      await this.input.pressSequentially(query)
      await expect(this.input).toHaveValue(query)
    })
  }

  /** Asserts the input holds `text`. */
  public async expectValue(text: string): Promise<void> {
    await test.step(`${this.name}: expect value "${text}"`, async () => {
      await expect(this.input).toHaveValue(text)
    })
  }

  /** Asserts the list offers exactly `labels`, in order, opening it first. */
  public async expectOptionLabels(labels: string[]): Promise<void> {
    await test.step(`${this.name}: expect options ${labels.join(", ")}`, async () => {
      await this.openIfClosed()
      const listBox = await this.listBox()
      await expect(listBox.getByRole("option")).toHaveText(labels)
    })
  }

  /**
   * Asserts `label` is the suggestion that Enter would commit.
   *
   * Reads `data-highlighted` rather than asserting focus: a combo box always keeps DOM focus on
   * its input and marks the active option through `aria-activedescendant`, which `toBeFocused()`
   * cannot see.
   */
  public async expectHighlightedOption(label: string): Promise<void> {
    await test.step(`${this.name}: expect "${label}" highlighted`, async () => {
      const listBox = await this.listBox()
      await expect(listBox.getByRole("option", { name: label, exact: true })).toHaveAttribute(
        "data-highlighted",
        "true",
      )
    })
  }

  /**
   * Asserts the filter matched nothing.
   *
   * An empty collection renders a `role="presentation"` message in the listbox's place, so this
   * cannot be written as a listbox with zero options.
   */
  public async expectNoOptions(): Promise<void> {
    await test.step(`${this.name}: expect no options`, async () => {
      const listBox = await this.listBox()
      await expect(listBox).toHaveAttribute("role", "presentation")
    })
  }

  private async openIfClosed(): Promise<void> {
    await expect(this.input).toBeVisible()
    if ((await this.input.getAttribute("aria-expanded")) !== "true") {
      // The popover is non-modal, so any page scroll closes it again. Playwright scrolls before
      // every click, so get the input into view now, while nothing is open to lose, and the list
      // then opens somewhere an option can be clicked without scrolling further.
      await this.input.scrollIntoViewIfNeeded()
      await this.input.click()
    }
    await expect(this.input).toHaveAttribute("aria-expanded", "true")
  }

  private async listBox(): Promise<Locator> {
    return await overlayControlledBy(this.page, this.input)
  }

  private async expectClosedShowing(label: string): Promise<void> {
    await expect(this.input).toHaveAttribute("aria-expanded", "false")
    await expect(this.input).toHaveValue(label)
  }
}
