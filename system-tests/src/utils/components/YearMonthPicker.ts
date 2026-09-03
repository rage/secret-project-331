import type { Locator } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { DATE_PICKER_LABELS } from "./dateTimeNames"

/**
 * Driver for the month/year chooser grid.
 *
 * The same primitive backs `YearMonthField`'s popover and the chooser view of the calendar, so this
 * takes whichever overlay contains it. It shares nothing with the segmented fields: no spinbuttons,
 * a roving `tabIndex` over plain buttons, and a month view and a year view that replace each other.
 *
 * That root can be the popover surface itself, which also holds the two invisible "Dismiss" buttons
 * every popover carries, so buttons here are matched on an exact name.
 */
export class YearMonthPicker {
  private readonly root: Locator

  public constructor(root: Locator) {
    this.root = root
  }

  /** One month button, named by the locale's full month name. */
  public getMonthOption(monthLabel: string): Locator {
    return this.root.getByRole("button", { name: monthLabel, exact: true })
  }

  /** One year button on the visible twelve-year page. */
  public getYearOption(year: number | string): Locator {
    return this.root.getByRole("button", { name: String(year), exact: true })
  }

  /** Picks a month, which unmounts the chooser in both of its hosts. */
  public async chooseMonth(monthLabel: string): Promise<void> {
    await test.step(`Choose ${monthLabel}`, async () => {
      const option = this.getMonthOption(monthLabel)
      await option.click()
      await expect(option).toBeHidden()
    })
  }

  /** Picks a year from the year view, which then returns to the month view. */
  public async chooseYear(year: number | string): Promise<void> {
    await test.step(`Choose ${year}`, async () => {
      await this.getYearOption(year).click()
      await expect(this.getTitle(DATE_PICKER_LABELS.chooseMonth)).toBeVisible()
    })
  }

  public async openYearView(): Promise<void> {
    await test.step("Open the year view", async () => {
      await this.getButton(DATE_PICKER_LABELS.chooseYear).click()
      await expect(this.getTitle(DATE_PICKER_LABELS.chooseYear)).toBeVisible()
    })
  }

  /** Leaves the year view. Inside the calendar this goes back to the days, not to the month view. */
  public async closeYearView(): Promise<void> {
    await test.step("Leave the year view", async () => {
      await this.getButton(DATE_PICKER_LABELS.chooseMonth).click()
      await expect(this.getTitle(DATE_PICKER_LABELS.chooseYear)).toBeHidden()
    })
  }

  public async goToPreviousYear(): Promise<void> {
    await test.step("Go to the previous year", async () => {
      await this.pageMonthView(DATE_PICKER_LABELS.previousYear)
    })
  }

  public async goToNextYear(): Promise<void> {
    await test.step("Go to the next year", async () => {
      await this.pageMonthView(DATE_PICKER_LABELS.nextYear)
    })
  }

  public async goToPreviousYearPage(): Promise<void> {
    await test.step("Go to the previous twelve years", async () => {
      await this.pageYearView(DATE_PICKER_LABELS.previousYears)
    })
  }

  public async goToNextYearPage(): Promise<void> {
    await test.step("Go to the next twelve years", async () => {
      await this.pageYearView(DATE_PICKER_LABELS.nextYears)
    })
  }

  private getButton(label: string): Locator {
    return this.root.getByRole("button", { name: label, exact: true })
  }

  /**
   * The heading of the current view.
   *
   * `getByText` only matches elements holding the text directly, so this never collides with the
   * back button that carries the other view's name as its `aria-label`.
   */
  private getTitle(label: string): Locator {
    return this.root.getByText(label, { exact: true })
  }

  private async pageMonthView(label: string): Promise<void> {
    const draftYear = this.getButton(DATE_PICKER_LABELS.chooseYear)
    const before = (await draftYear.textContent()) ?? ""
    await this.getButton(label).click()
    await expect(draftYear).not.toHaveText(before)
  }

  private async pageYearView(label: string): Promise<void> {
    const firstYear = this.root.getByRole("button", { name: /^\d{4}$/ }).first()
    const before = (await firstYear.textContent()) ?? ""
    await this.getButton(label).click()
    await expect(firstYear).not.toHaveText(before)
  }
}
