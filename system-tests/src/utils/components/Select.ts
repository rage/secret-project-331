import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { overlayControlledBy } from "./overlays"

/** Options for {@link Select}. */
export interface SelectOptions {
  /** Tells this select apart from others in the Playwright trace. */
  name?: string
}

const DEFAULT_NAME = "Select"

/**
 * Drives a shared-module `Select`.
 *
 * The component is a button plus a listbox portaled to `document.body`, not a native `<select>`,
 * so `locator.selectOption()` can never work on it and the listbox is not a descendant of the
 * trigger. Construct with the trigger button, ideally located by its `data-testid`: the trigger's
 * accessible name is `"<value> <label>"`, which changes every time the value does.
 *
 * The sibling driver for the filterable, free-text variant is `ComboBox`.
 */
export class Select {
  private readonly page: Page
  private readonly trigger: Locator
  private readonly name: string

  public constructor(page: Page, trigger: Locator, opts: SelectOptions = {}) {
    this.page = page
    this.trigger = trigger
    this.name = opts.name ?? DEFAULT_NAME
  }

  /** The trigger button, for assertions this driver does not cover. */
  public getTrigger(): Locator {
    return this.trigger
  }

  /** Opens the listbox and leaves it open. */
  public async open(): Promise<void> {
    await test.step(`${this.name}: open`, async () => {
      await this.openIfClosed()
    })
  }

  /** Closes the listbox without changing the selection. */
  public async close(): Promise<void> {
    await test.step(`${this.name}: close`, async () => {
      await this.page.keyboard.press("Escape")
      await expect(this.trigger).toHaveAttribute("aria-expanded", "false")
    })
  }

  /**
   * Selects the option rendering as `label`, opening the listbox first.
   *
   * `label` is matched whole, after whitespace trimming. Use {@link chooseOptionByValue} when the
   * spec knows the option's form value but not the text it renders as.
   */
  public async chooseOption(label: string): Promise<void> {
    await test.step(`${this.name}: choose "${label}"`, async () => {
      await this.openIfClosed()
      const listBox = await this.listBox()
      // Opening and choosing must stay separate clicks: the listbox sets shouldSelectOnPressUp
      // false, so the press that opens it never selects.
      await listBox.getByRole("option", { name: label, exact: true }).click()
      await this.expectClosedShowing(label)
    })
  }

  /**
   * Selects the option carrying `value` in the `options` array.
   *
   * For ids and other values a spec holds but a user never sees; prefer {@link chooseOption}
   * wherever the visible label is known.
   */
  public async chooseOptionByValue(value: string): Promise<void> {
    await test.step(`${this.name}: choose value "${value}"`, async () => {
      await this.openIfClosed()
      const listBox = await this.listBox()
      const option = listBox.locator(`[role="option"][data-key=${JSON.stringify(value)}]`)
      const label = ((await option.textContent()) ?? "").trim()
      await option.click()
      await this.expectClosedShowing(label)
    })
  }

  /**
   * Types `query` into the popover's search field, narrowing the options to the matches.
   *
   * Filtering is live only while the search field holds focus, so read the results before doing
   * anything that moves focus elsewhere. Only selects rendered with `searchEnabled` have one.
   */
  public async search(query: string): Promise<void> {
    await test.step(`${this.name}: search "${query}"`, async () => {
      await this.openIfClosed()
      const searchBox = await this.searchBox()
      await searchBox.fill(query)
      await expect(searchBox).toBeFocused()
    })
  }

  /** Asserts the trigger shows `label`. Pass the placeholder to assert nothing is selected. */
  public async expectSelectedOption(label: string): Promise<void> {
    await test.step(`${this.name}: expect "${label}" selected`, async () => {
      await expect(this.trigger).toHaveText(label)
    })
  }

  /** Asserts the listbox offers exactly `labels`, in order, opening it first. */
  public async expectOptionLabels(labels: string[]): Promise<void> {
    await test.step(`${this.name}: expect options ${labels.join(", ")}`, async () => {
      await this.openIfClosed()
      const listBox = await this.listBox()
      await expect(listBox.getByRole("option")).toHaveText(labels)
    })
  }

  /**
   * Asserts `label` is the option that keyboard navigation would act on.
   *
   * Reads `data-highlighted` rather than asserting focus: with `searchEnabled` the select keeps
   * DOM focus on the search field and marks the active option through `aria-activedescendant`,
   * which `toBeFocused()` cannot see.
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
   * Asserts the search matched nothing.
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
    await expect(this.trigger).toBeVisible()
    if ((await this.trigger.getAttribute("aria-expanded")) !== "true") {
      await this.trigger.click()
    }
    await expect(this.trigger).toHaveAttribute("aria-expanded", "true")
  }

  private listBox(): Promise<Locator> {
    // Resolves to the empty-state element rather than a listbox when nothing matches the filter.
    return overlayControlledBy(this.page, this.trigger)
  }

  private async searchBox(): Promise<Locator> {
    // Only the list is addressable from aria-controls; the search field is its sibling in the
    // popover, so it has to be reached through their shared parent.
    const listBox = await this.listBox()
    return listBox.locator("xpath=..").getByRole("searchbox")
  }

  private async expectClosedShowing(label: string): Promise<void> {
    await expect(this.trigger).toHaveAttribute("aria-expanded", "false")
    await expect(this.trigger).toHaveText(label)
  }
}
